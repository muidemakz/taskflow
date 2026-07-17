import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();
const RETENTION_DAYS = 30;

function cutoff() {
  return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

// Lazy sweep: no cron/new infra needed. Opportunistically hard-deletes
// anything past the retention window whenever the trash is listed. Hard
// deleting the Project still cascades to its Tasks/Groups/Gates via the
// existing Postgres FK cascade constraints, which is exactly the "actually
// gone" behavior wanted once the window has passed.
async function sweepExpiredTrash(ownerId) {
  const before = cutoff();
  const expiredProjects = await prisma.project.findMany({
    where: { ownerId, deletedAt: { lt: before } },
    select: { id: true }
  });
  if (expiredProjects.length) {
    await prisma.project.deleteMany({ where: { id: { in: expiredProjects.map((p) => p.id) } } });
  }
  // Items soft-deleted independently of their (still-live) project also
  // expire on their own.
  await Promise.all([
    prisma.task.deleteMany({ where: { deletedAt: { lt: before }, project: { ownerId } } }),
    prisma.group.deleteMany({ where: { deletedAt: { lt: before }, project: { ownerId } } }),
    prisma.gate.deleteMany({ where: { deletedAt: { lt: before }, roadmap: { project: { ownerId } } } }),
    prisma.tag.deleteMany({ where: { deletedAt: { lt: before }, project: { ownerId } } }),
    prisma.docEntry.deleteMany({ where: { deletedAt: { lt: before }, project: { ownerId } } }),
    prisma.docCategory.deleteMany({ where: { deletedAt: { lt: before }, project: { ownerId } } })
  ]);
}

router.get('/', async (req, res, next) => {
  try {
    await sweepExpiredTrash(req.auth.sub);

    const projectId = req.query.projectId || undefined;
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: req.auth.sub } });
      if (!project) return res.status(404).json({ message: 'Project not found' });
    }

    const projectScope = projectId ? { id: projectId } : { ownerId: req.auth.sub };
    const [projects, tasks, groups, gates, tags, docs, categories] = await Promise.all([
      prisma.project.findMany({ where: { ownerId: req.auth.sub, deletedAt: { not: null }, ...(projectId ? { id: projectId } : {}) } }),
      prisma.task.findMany({ where: { deletedAt: { not: null }, project: projectScope } }),
      prisma.group.findMany({ where: { deletedAt: { not: null }, project: projectScope } }),
      prisma.gate.findMany({ where: { deletedAt: { not: null }, roadmap: { project: projectScope } } }),
      prisma.tag.findMany({ where: { deletedAt: { not: null }, project: projectScope } }),
      prisma.docEntry.findMany({ where: { deletedAt: { not: null }, project: projectScope } }),
      prisma.docCategory.findMany({ where: { deletedAt: { not: null }, project: projectScope } })
    ]);

    res.json({
      retentionDays: RETENTION_DAYS,
      items: [
        ...projects.map((p) => ({ type: 'project', id: p.id, title: p.title, deletedAt: p.deletedAt })),
        ...tasks.map((t) => ({ type: 'task', id: t.id, title: t.title, customId: t.customId, projectId: t.projectId, deletedAt: t.deletedAt })),
        ...groups.map((g) => ({ type: 'group', id: g.id, title: g.title, projectId: g.projectId, deletedAt: g.deletedAt })),
        ...gates.map((g) => ({ type: 'gate', id: g.id, title: g.name, deletedAt: g.deletedAt })),
        ...tags.map((t) => ({ type: 'tag', id: t.id, title: t.name, projectId: t.projectId, deletedAt: t.deletedAt })),
        ...docs.map((d) => ({ type: 'doc', id: d.id, title: d.title, projectId: d.projectId, deletedAt: d.deletedAt })),
        ...categories.map((c) => ({ type: 'category', id: c.id, title: c.name, projectId: c.projectId, deletedAt: c.deletedAt }))
      ]
    });
  } catch (error) {
    next(error);
  }
});

// Restores the item, plus (for a project) everything currently
// soft-deleted alongside it -- Tasks/Groups/Gates/Tags that are also
// trashed right now, which in practice is what got deleted together with
// it, since children are not independently soft-deleted at the same time
// their (still-trashed) parent coincidentally also is.
router.post('/:type/:id/restore', async (req, res, next) => {
  try {
    const { type, id } = req.params;

    if (type === 'project') {
      const project = await prisma.project.findFirst({ where: { id, ownerId: req.auth.sub, deletedAt: { not: null } } });
      if (!project) return res.status(404).json({ message: 'Trashed project not found' });
      const roadmap = await prisma.roadmap.findUnique({ where: { projectId: project.id } });
      await prisma.$transaction([
        prisma.project.update({ where: { id: project.id }, data: { deletedAt: null } }),
        prisma.task.updateMany({ where: { projectId: project.id, deletedAt: { not: null } }, data: { deletedAt: null } }),
        prisma.group.updateMany({ where: { projectId: project.id, deletedAt: { not: null } }, data: { deletedAt: null } }),
        prisma.tag.updateMany({ where: { projectId: project.id, deletedAt: { not: null } }, data: { deletedAt: null } }),
        prisma.docEntry.updateMany({ where: { projectId: project.id, deletedAt: { not: null } }, data: { deletedAt: null } }),
        prisma.docCategory.updateMany({ where: { projectId: project.id, deletedAt: { not: null } }, data: { deletedAt: null } }),
        ...(roadmap ? [prisma.gate.updateMany({ where: { roadmapId: roadmap.id, deletedAt: { not: null } }, data: { deletedAt: null } })] : [])
      ]);
      return res.json({ restored: 'project', id: project.id });
    }

    if (type === 'task') {
      const task = await prisma.task.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!task) return res.status(404).json({ message: 'Trashed task not found' });
      await prisma.task.update({ where: { id: task.id }, data: { deletedAt: null } });
      return res.json({ restored: 'task', id: task.id });
    }

    if (type === 'group') {
      const group = await prisma.group.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!group) return res.status(404).json({ message: 'Trashed group not found' });
      await prisma.group.update({ where: { id: group.id }, data: { deletedAt: null } });
      return res.json({ restored: 'group', id: group.id });
    }

    if (type === 'gate') {
      const gate = await prisma.gate.findFirst({ where: { id, deletedAt: { not: null }, roadmap: { project: { ownerId: req.auth.sub } } } });
      if (!gate) return res.status(404).json({ message: 'Trashed gate not found' });
      await prisma.gate.update({ where: { id: gate.id }, data: { deletedAt: null } });
      return res.json({ restored: 'gate', id: gate.id });
    }

    if (type === 'tag') {
      const tag = await prisma.tag.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!tag) return res.status(404).json({ message: 'Trashed tag not found' });
      await prisma.tag.update({ where: { id: tag.id }, data: { deletedAt: null } });
      return res.json({ restored: 'tag', id: tag.id });
    }

    if (type === 'doc') {
      const doc = await prisma.docEntry.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!doc) return res.status(404).json({ message: 'Trashed doc not found' });
      // Annotations were stamped with the doc's own deletedAt at delete time
      // (see docs.js), so this restores exactly the ones that came down
      // with it, not any annotation independently deleted before that.
      await prisma.$transaction([
        prisma.docEntry.update({ where: { id: doc.id }, data: { deletedAt: null } }),
        prisma.docAnnotation.updateMany({ where: { docEntryId: doc.id, deletedAt: doc.deletedAt }, data: { deletedAt: null } })
      ]);
      return res.json({ restored: 'doc', id: doc.id });
    }

    if (type === 'category') {
      const category = await prisma.docCategory.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!category) return res.status(404).json({ message: 'Trashed category not found' });
      await prisma.docCategory.update({ where: { id: category.id }, data: { deletedAt: null } });
      return res.json({ restored: 'category', id: category.id });
    }

    res.status(400).json({ message: 'type must be one of: project, task, group, gate, tag, doc, category' });
  } catch (error) {
    next(error);
  }
});

export default router;
