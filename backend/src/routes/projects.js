import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { defaultOrder, orderArray, projectInclude, serializeOrder, taskCounts, toClientProject } from '../utils/project.js';
import { appendPosition } from '../lib/position.js';
import { createTaskWithCustomId } from '../utils/customId.js';
import { requireGate } from '../lib/ownership.js';
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

// gateCount/taskCount are project-wide counts (every gate in the project's
// roadmap; every non-deleted task regardless of grouping), not the
// legacy-model taskCounts() stats -- kept separate so an edge case in one
// doesn't silently skew the other. Cheap enough to run per-project on every
// list/detail response at this scale (no pagination anywhere in this API).
async function projectMetrics(projectId) {
  const [gateCount, taskCount] = await Promise.all([
    prisma.gate.count({ where: { roadmap: { projectId }, deletedAt: null } }),
    prisma.task.count({ where: { projectId, deletedAt: null } })
  ]);
  return { gateCount, taskCount };
}

async function withMetrics(project) {
  return { ...toClientProject(project), stats: taskCounts(project), metrics: await projectMetrics(project.id) };
}

router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: req.auth.sub, deletedAt: null },
      include: projectInclude,
      orderBy: { updatedAt: 'desc' }
    });
    res.json(await Promise.all(projects.map(withMetrics)));
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
    res.status(201).json(await withMetrics(project));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await ownedProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(await withMetrics(project));
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
    if ('promptRulesCategoryId' in req.body) {
      if (req.body.promptRulesCategoryId) {
        const category = await prisma.docCategory.findFirst({ where: { id: req.body.promptRulesCategoryId, projectId: project.id, deletedAt: null } });
        if (!category) return res.status(400).json({ message: 'promptRulesCategoryId does not belong to this project' });
        data.promptRulesCategoryId = category.id;
      } else {
        data.promptRulesCategoryId = null;
      }
    }
    // One-way flag: once the forced first-visit settings prompt has been
    // shown and dismissed (Save or Cancel), it never re-triggers for this
    // project, so this only ever needs to go false -> true.
    if (req.body.hasConfigured === true) data.hasConfigured = true;
    const updated = await prisma.project.update({ where: { id: project.id }, data, include: projectInclude });
    res.json(await withMetrics(updated));
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
      ...(await withMetrics(updated)),
      shareUrl: `${frontend.replace(/\/$/, '')}/share/${updated.shareToken}`
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
    res.status(201).json(await withMetrics(updated));
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

    // Optional gateId lets callers create straight into a gate (quick-add
    // from a gate card, or a gate picked in the quick-add modal) so the
    // customId is generated against the task's real, final gate in one
    // atomic step -- not assigned Unscheduled and then silently stuck that
    // way once the caller's separate follow-up "move" call lands (customId
    // never changes once set, so getting it right at creation matters here).
    let gate = null;
    if (req.body.gateId) {
      gate = await requireGate(req.body.gateId, req.auth.sub);
      if (!gate || gate.roadmap.projectId !== project.id) {
        return res.status(400).json({ message: 'gateId does not belong to this project' });
      }
    }

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

    const task = await createTaskWithCustomId(prisma, project.id, gate, {
      title,
      projectId: project.id,
      groupId,
      gateId: gate?.id || null,
      priority,
      statusId: backlogStatus.id,
      position: appendPosition(maxPosition)
    });
    if (!groupId) {
      await prisma.project.update({
        where: { id: project.id },
        data: { order: serializeOrder([`task:${task.id}`, ...(orderArray(project).length ? orderArray(project) : defaultOrder(project))]) }
      });
    }
    const updated = await ownedProject(project.id, req.auth.sub);
    res.status(201).json({ ...(await withMetrics(updated)), taskId: task.id });
  } catch (error) {
    next(error);
  }
});

export default router;
