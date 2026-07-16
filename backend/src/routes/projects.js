import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { defaultOrder, orderArray, projectInclude, serializeOrder, taskCounts, toClientProject } from '../utils/project.js';
import { appendPosition } from '../lib/position.js';
import { STARTER_CATEGORIES } from './docCategories.js';

const router = Router();

// Same convention as the Prompt 1 migration's backfill seed.
const DEFAULT_STATUSES = [
  { name: 'Backlog', order: 0, countsAsDone: false },
  { name: 'To-do', order: 1, countsAsDone: false },
  { name: 'In progress', order: 2, countsAsDone: false },
  { name: 'In review', order: 3, countsAsDone: false },
  { name: 'Done', order: 4, countsAsDone: true }
];

async function ownedProject(id, ownerId) {
  return prisma.project.findFirst({ where: { id, ownerId, deletedAt: null }, include: projectInclude });
}

router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: req.auth.sub, deletedAt: null },
      include: projectInclude,
      orderBy: { updatedAt: 'desc' }
    });
    res.json(projects.map((project) => ({ ...toClientProject(project), stats: taskCounts(project) })));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const title = req.body.title?.trim();
    if (!title) return res.status(400).json({ message: 'Project title is required' });
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: { title, description: req.body.description?.trim() || null, ownerId: req.auth.sub, order: serializeOrder([]) }
      });
      await tx.status.createMany({
        data: DEFAULT_STATUSES.map((status) => ({ ...status, projectId: created.id }))
      });
      await tx.docCategory.createMany({
        data: STARTER_CATEGORIES.map((name) => ({ name, projectId: created.id }))
      });
      return tx.project.findUnique({ where: { id: created.id }, include: projectInclude });
    });
    res.status(201).json(toClientProject(project));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await ownedProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ ...toClientProject(project), stats: taskCounts(project) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const project = await ownedProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const data = {};
    if (typeof req.body.title === 'string' && req.body.title.trim()) data.title = req.body.title.trim();
    if (typeof req.body.description === 'string') data.description = req.body.description.trim() || null;
    if (Array.isArray(req.body.order)) data.order = serializeOrder(req.body.order);
    if (req.body.rolloverMode) {
      if (!['AUTOMATIC', 'ASK_FIRST'].includes(req.body.rolloverMode)) {
        return res.status(400).json({ message: 'rolloverMode must be AUTOMATIC or ASK_FIRST' });
      }
      data.rolloverMode = req.body.rolloverMode;
    }
    const updated = await prisma.project.update({ where: { id: project.id }, data, include: projectInclude });
    res.json({ ...toClientProject(updated), stats: taskCounts(updated) });
  } catch (error) {
    next(error);
  }
});

// Soft delete: the Project and all its Tasks/Groups/Gates/Tags are
// deletedAt-stamped together in one transaction. Deleting a single Task
// elsewhere does not touch its Project (see tasks.js) -- this is the only
// direction the cascade runs.
router.delete('/:id', async (req, res, next) => {
  try {
    const project = await ownedProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const roadmap = await tx.roadmap.findUnique({ where: { projectId: project.id } });
      const [tasks, groups, gates, tags, docs, categories] = await Promise.all([
        tx.task.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } }),
        tx.group.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } }),
        roadmap
          ? tx.gate.updateMany({ where: { roadmapId: roadmap.id, deletedAt: null }, data: { deletedAt: now } })
          : Promise.resolve({ count: 0 }),
        tx.tag.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } }),
        tx.docEntry.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } }),
        tx.docCategory.updateMany({ where: { projectId: project.id, deletedAt: null }, data: { deletedAt: now } })
      ]);
      await tx.project.update({ where: { id: project.id }, data: { deletedAt: now } });
      return { tasks: tasks.count, groups: groups.count, gates: gates.count, tags: tags.count, docs: docs.count, categories: categories.count };
    });

    res.json({
      deletedProject: { id: project.id, title: project.title, deletedAt: now },
      deletedCounts: result
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/share', async (req, res, next) => {
  try {
    const project = await ownedProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { shareEnabled: Boolean(req.body.shareEnabled) },
      include: projectInclude
    });
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.json({
      ...toClientProject(updated),
      shareUrl: `${frontend.replace(/\/$/, '')}/share/${updated.shareToken}`,
      stats: taskCounts(updated)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/groups', async (req, res, next) => {
  try {
    const project = await ownedProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const title = req.body.title?.trim() || 'New Group';
    const group = await prisma.group.create({ data: { title, projectId: project.id } });
    await prisma.project.update({
      where: { id: project.id },
      data: { order: serializeOrder([`group:${group.id}`, ...(orderArray(project).length ? orderArray(project) : defaultOrder(project))]) }
    });
    const updated = await ownedProject(project.id, req.auth.sub);
    res.status(201).json({ ...toClientProject(updated), stats: taskCounts(updated) });
  } catch (error) {
    next(error);
  }
});

// This endpoint predates the Status model. Until the new frontend (Prompt
// 3) replaces it, every task created here must still land with a real
// statusId -- otherwise it silently violates the one-true-status
// invariant the whole roadmap/kanban API relies on. Same convention as
// the external-upsert endpoint: first non-done status (lowest `order`),
// appended to the end of that column.
router.post('/:id/tasks', async (req, res, next) => {
  try {
    const project = await ownedProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const title = req.body.title?.trim() || 'New Task';
    const groupId = req.body.groupId || null;
    if (groupId && !project.groups.some((group) => group.id === groupId)) {
      return res.status(400).json({ message: 'Group does not belong to this project' });
    }
    const priority = ['LOW', 'MID', 'HIGH', 'NONE'].includes(req.body.priority) ? req.body.priority : 'NONE';

    const backlogStatus = await prisma.status.findFirst({
      where: { projectId: project.id, countsAsDone: false },
      orderBy: { order: 'asc' }
    });
    if (!backlogStatus) {
      // Every project gets its 5 default statuses at creation time now
      // (see POST /). This should be unreachable -- if it isn't, that's a
      // real data-integrity bug worth surfacing loudly, not silently
      // falling back to statusId: null again.
      throw new Error(`Project ${project.id} has no non-done status configured`);
    }
    const maxPosition = (await prisma.task.aggregate({ where: { statusId: backlogStatus.id }, _max: { position: true } }))._max.position;

    const task = await prisma.task.create({
      data: {
        title,
        projectId: project.id,
        groupId,
        priority,
        statusId: backlogStatus.id,
        position: appendPosition(maxPosition)
      }
    });
    if (!groupId) {
      await prisma.project.update({
        where: { id: project.id },
        data: { order: serializeOrder([`task:${task.id}`, ...(orderArray(project).length ? orderArray(project) : defaultOrder(project))]) }
      });
    }
    const updated = await ownedProject(project.id, req.auth.sub);
    res.status(201).json({ ...toClientProject(updated), stats: taskCounts(updated) });
  } catch (error) {
    next(error);
  }
});

export default router;
