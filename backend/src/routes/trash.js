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
    prisma.docCategory.deleteMany({ where: { deletedAt: { lt: before }, project: { ownerId } } }),
    // NoteChat has no project to route the FK cascade through the way the
    // items above do -- userId is its own direct owner column. The cascade
    // to NoteMessage still happens the same way (onDelete: Cascade in the
    // schema), just triggered from this deleteMany instead of a `project:`
    // relation filter.
    prisma.noteChat.deleteMany({ where: { deletedAt: { lt: before }, userId: ownerId } })
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
    const [projects, tasks, groups, gates, tags, docs, categories, noteChats] = await Promise.all([
      prisma.project.findMany({ where: { ownerId: req.auth.sub, deletedAt: { not: null }, ...(projectId ? { id: projectId } : {}) } }),
      prisma.task.findMany({ where: { deletedAt: { not: null }, project: projectScope } }),
      prisma.group.findMany({ where: { deletedAt: { not: null }, project: projectScope } }),
      prisma.gate.findMany({ where: { deletedAt: { not: null }, roadmap: { project: projectScope } } }),
      prisma.tag.findMany({ where: { deletedAt: { not: null }, project: projectScope } }),
      prisma.docEntry.findMany({ where: { deletedAt: { not: null }, project: projectScope } }),
      prisma.docCategory.findMany({ where: { deletedAt: { not: null }, project: projectScope } }),
      // Notes have no required project link (userId is the direct owner),
      // so this only respects the optional ?projectId filter when a chat is
      // actually linked to that project -- it's never excluded by the
      // project-scoped queries above the way it would be if routed through
      // `project: projectScope` like everything else here.
      prisma.noteChat.findMany({ where: { userId: req.auth.sub, deletedAt: { not: null }, ...(projectId ? { projectId } : {}) } })
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
        ...categories.map((c) => ({ type: 'category', id: c.id, title: c.name, projectId: c.projectId, deletedAt: c.deletedAt })),
        ...noteChats.map((c) => ({ type: 'notechat', id: c.id, title: c.title || 'Untitled note', projectId: c.projectId, deletedAt: c.deletedAt }))
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

    if (type === 'notechat') {
      const chat = await prisma.noteChat.findFirst({ where: { id, userId: req.auth.sub, deletedAt: { not: null } } });
      if (!chat) return res.status(404).json({ message: 'Trashed chat not found' });
      // Messages are never touched at delete time (see notes.js) -- only
      // the chat itself gets a deletedAt -- so restoring just the chat is
      // enough for its messages to become reachable again through the
      // normal deletedAt: null filters everywhere else.
      await prisma.noteChat.update({ where: { id: chat.id }, data: { deletedAt: null } });
      return res.json({ restored: 'notechat', id: chat.id });
    }

    res.status(400).json({ message: 'type must be one of: project, task, group, gate, tag, doc, category, notechat' });
  } catch (error) {
    next(error);
  }
});

// Hard-deletes a trashed item immediately instead of waiting out the
// retention window. Postgres FK cascades (see schema.prisma) take care of
// children the same way the retention sweep above does -- deleting a
// Project cascades to its Tasks/Groups/Gates/Tags/Docs, deleting a Task
// cascades to its TaskTags/PromptVersions/etc.
router.delete('/:type/:id', async (req, res, next) => {
  try {
    const { type, id } = req.params;

    if (type === 'project') {
      const project = await prisma.project.findFirst({ where: { id, ownerId: req.auth.sub, deletedAt: { not: null } } });
      if (!project) return res.status(404).json({ message: 'Trashed project not found' });
      await prisma.project.delete({ where: { id: project.id } });
      return res.json({ deleted: 'project', id: project.id });
    }

    if (type === 'task') {
      const task = await prisma.task.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!task) return res.status(404).json({ message: 'Trashed task not found' });
      await prisma.task.delete({ where: { id: task.id } });
      return res.json({ deleted: 'task', id: task.id });
    }

    if (type === 'group') {
      const group = await prisma.group.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!group) return res.status(404).json({ message: 'Trashed group not found' });
      await prisma.group.delete({ where: { id: group.id } });
      return res.json({ deleted: 'group', id: group.id });
    }

    if (type === 'gate') {
      const gate = await prisma.gate.findFirst({ where: { id, deletedAt: { not: null }, roadmap: { project: { ownerId: req.auth.sub } } } });
      if (!gate) return res.status(404).json({ message: 'Trashed gate not found' });
      await prisma.gate.delete({ where: { id: gate.id } });
      return res.json({ deleted: 'gate', id: gate.id });
    }

    if (type === 'tag') {
      const tag = await prisma.tag.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!tag) return res.status(404).json({ message: 'Trashed tag not found' });
      await prisma.tag.delete({ where: { id: tag.id } });
      return res.json({ deleted: 'tag', id: tag.id });
    }

    if (type === 'doc') {
      const doc = await prisma.docEntry.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!doc) return res.status(404).json({ message: 'Trashed doc not found' });
      await prisma.docEntry.delete({ where: { id: doc.id } });
      return res.json({ deleted: 'doc', id: doc.id });
    }

    if (type === 'category') {
      const category = await prisma.docCategory.findFirst({ where: { id, deletedAt: { not: null }, project: { ownerId: req.auth.sub } } });
      if (!category) return res.status(404).json({ message: 'Trashed category not found' });
      await prisma.docCategory.delete({ where: { id: category.id } });
      return res.json({ deleted: 'category', id: category.id });
    }

    if (type === 'notechat') {
      const chat = await prisma.noteChat.findFirst({ where: { id, userId: req.auth.sub, deletedAt: { not: null } } });
      if (!chat) return res.status(404).json({ message: 'Trashed chat not found' });
      // NoteMessage.chatId has onDelete: Cascade (schema.prisma) -- deleting
      // the chat row also deletes every one of its messages at the DB
      // level, live or already soft-deleted, the same way deleting a
      // Project cascades to its Tasks.
      await prisma.noteChat.delete({ where: { id: chat.id } });
      return res.json({ deleted: 'notechat', id: chat.id });
    }

    res.status(400).json({ message: 'type must be one of: project, task, group, gate, tag, doc, category, notechat' });
  } catch (error) {
    next(error);
  }
});

export default router;
