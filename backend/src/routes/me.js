import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/tasks', async (req, res, next) => {
  try {
    const doneStatuses = await prisma.status.findMany({
      where: { project: { ownerId: req.auth.sub }, countsAsDone: true },
      select: { id: true }
    });
    const doneIds = doneStatuses.map((s) => s.id);

    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        project: { ownerId: req.auth.sub, deletedAt: null },
        // NULL statusId (e.g. a task created through the legacy endpoint,
        // which doesn't set one) must count as "not done" -- SQL's
        // three-valued logic means a plain `notIn` silently drops NULLs.
        OR: [{ statusId: null }, { statusId: { notIn: doneIds } }]
      },
      include: {
        project: { select: { id: true, title: true } },
        gate: { select: { id: true, name: true } },
        taskStatus: { select: { id: true, name: true } },
        tags: { include: { tag: true } }
      },
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }]
    });

    const serialized = tasks.map((t) => ({ ...t, tags: t.tags.map((tt) => tt.tag) }));

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const in7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const buckets = {
      overdue: serialized.filter((t) => t.dueDate && new Date(t.dueDate) < startOfToday),
      today: serialized.filter((t) => t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) < endOfToday),
      upcoming: serialized.filter((t) => t.dueDate && new Date(t.dueDate) >= endOfToday && new Date(t.dueDate) < in7Days),
      focus: serialized.filter((t) => t.focus),
      allPending: serialized
    };

    res.json({ buckets });
  } catch (error) {
    next(error);
  }
});

export default router;
