import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// Read-only, unauthenticated by design (no Prompts panel, no Docs -- Docs
// is a real feature now but is deliberately never exposed here, this
// stays task-focused). A single shareToken resolves to exactly one of
// Project / Gate / Task, since each has its own independent unique token
// column rather than sharing one token+query-param scheme -- this keeps
// resolution unambiguous and the URL shape identical for every share type.
router.get('/:shareToken', async (req, res, next) => {
  try {
    const token = req.params.shareToken;

    const project = await prisma.project.findUnique({ where: { shareToken: token } });
    if (project) {
      if (project.deletedAt || !project.shareEnabled) return res.status(404).json({ message: 'This project is no longer shared' });
      return res.json(await buildProjectPayload(project));
    }

    const gate = await prisma.gate.findUnique({ where: { shareToken: token }, include: { roadmap: { include: { project: true } } } });
    if (gate) {
      if (gate.deletedAt || !gate.shareEnabled || gate.roadmap.project.deletedAt) {
        return res.status(404).json({ message: 'This gate is no longer shared' });
      }
      return res.json(await buildGatePayload(gate));
    }

    const task = await prisma.task.findUnique({
      where: { shareToken: token },
      include: { project: true, taskStatus: true, gate: { select: { id: true, name: true } }, tags: { include: { tag: true } } }
    });
    if (task) {
      if (task.deletedAt || !task.shareEnabled || task.project.deletedAt) {
        return res.status(404).json({ message: 'This task is no longer shared' });
      }
      return res.json(await buildTaskPayload(task));
    }

    res.status(404).json({ message: 'This link is no longer shared' });
  } catch (error) {
    next(error);
  }
});

async function buildProjectPayload(project) {
  const [statuses, tasksRaw, roadmap] = await Promise.all([
    prisma.status.findMany({ where: { projectId: project.id }, orderBy: { order: 'asc' } }),
    prisma.task.findMany({
      where: { projectId: project.id, deletedAt: null },
      include: { tags: { include: { tag: true } }, gate: { select: { id: true, name: true } } },
      orderBy: { position: 'asc' }
    }),
    project.hasRoadmap ? prisma.roadmap.findUnique({ where: { projectId: project.id } }) : Promise.resolve(null)
  ]);

  const tasks = tasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    statusId: t.statusId,
    gateId: t.gateId,
    gateName: t.gate?.name ?? null,
    priority: t.priority,
    dueDate: t.dueDate,
    blocked: t.blocked,
    tags: t.tags.map((tt) => tt.tag)
  }));

  const doneStatusIds = new Set(statuses.filter((s) => s.countsAsDone).map((s) => s.id));
  const total = tasks.length;
  const done = tasks.filter((t) => doneStatusIds.has(t.statusId)).length;

  let gates = [];
  if (roadmap) {
    const gateRows = await prisma.gate.findMany({ where: { roadmapId: roadmap.id, deletedAt: null }, orderBy: { order: 'asc' } });
    gates = gateRows.map((gate) => {
      const gateTasks = tasks.filter((t) => t.gateId === gate.id);
      const gDone = gateTasks.filter((t) => doneStatusIds.has(t.statusId)).length;
      return {
        id: gate.id,
        name: gate.name,
        order: gate.order,
        status: gate.status,
        progress: { total: gateTasks.length, done: gDone, pct: gateTasks.length ? Math.round((gDone / gateTasks.length) * 100) : 0 }
      };
    });
  }

  return {
    type: 'project',
    id: project.id,
    title: project.title,
    description: project.description,
    hasRoadmap: Boolean(roadmap),
    statuses: statuses.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      countsAsDone: s.countsAsDone,
      tasks: tasks.filter((t) => t.statusId === s.id)
    })),
    gates,
    stats: { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  };
}

// Scoped to one gate's tasks only -- no other gates, no Unscheduled, no
// docs. Same status-column shape as the project view so the frontend can
// reuse its rendering.
async function buildGatePayload(gate) {
  const projectId = gate.roadmap.projectId;
  const [statuses, tasksRaw] = await Promise.all([
    prisma.status.findMany({ where: { projectId }, orderBy: { order: 'asc' } }),
    prisma.task.findMany({
      where: { gateId: gate.id, deletedAt: null },
      include: { tags: { include: { tag: true } } },
      orderBy: { position: 'asc' }
    })
  ]);

  const tasks = tasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    statusId: t.statusId,
    priority: t.priority,
    dueDate: t.dueDate,
    blocked: t.blocked,
    tags: t.tags.map((tt) => tt.tag)
  }));

  const doneStatusIds = new Set(statuses.filter((s) => s.countsAsDone).map((s) => s.id));
  const total = tasks.length;
  const done = tasks.filter((t) => doneStatusIds.has(t.statusId)).length;

  return {
    type: 'gate',
    id: gate.id,
    name: gate.name,
    description: gate.description,
    status: gate.status,
    closedAt: gate.closedAt,
    closedReason: gate.closedReason,
    projectTitle: gate.roadmap.project.title,
    statuses: statuses.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      countsAsDone: s.countsAsDone,
      tasks: tasks.filter((t) => t.statusId === s.id)
    })),
    stats: { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  };
}

// Single task, read-only, including its (already-public-once-shared)
// activity trail -- no edit affordances, no linked docs (docs stay
// authenticated-only everywhere, matching the project/gate share views).
async function buildTaskPayload(task) {
  const activity = await prisma.taskActivity.findMany({
    where: { taskId: task.id },
    include: { changedBy: { select: { name: true } } },
    orderBy: { changedAt: 'desc' }
  });

  return {
    type: 'task',
    id: task.id,
    title: task.title,
    comment: task.comment,
    priority: task.priority,
    dueDate: task.dueDate,
    blocked: task.blocked,
    blockedNote: task.blockedNote,
    statusName: task.taskStatus?.name ?? null,
    gateName: task.gate?.name ?? null,
    tags: task.tags.map((tt) => tt.tag),
    projectTitle: task.project.title,
    activity
  };
}

export default router;
