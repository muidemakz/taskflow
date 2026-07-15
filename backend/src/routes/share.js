import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// Rebuilt against the roadmap/kanban model (status columns + gate
// progress) rather than the legacy Group/checklist model. Read-only: no
// Prompts panel, no Docs -- neither exists as a real feature yet, and this
// is a viewer, not the app.
router.get('/:shareToken', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { shareToken: req.params.shareToken } });
    if (!project || project.deletedAt || !project.shareEnabled) {
      return res.status(404).json({ message: 'This project is no longer shared' });
    }

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
          progress: { total: gateTasks.length, done: gDone, pct: gateTasks.length ? Math.round((gDone / gateTasks.length) * 100) : 0 }
        };
      });
    }

    res.json({
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
    });
  } catch (error) {
    next(error);
  }
});

export default router;
