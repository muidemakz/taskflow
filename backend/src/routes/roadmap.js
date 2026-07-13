import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireProject } from '../lib/ownership.js';

const router = Router();

// Progress is computed with SQL groupBy aggregates (COUNT per gate, per
// gate+doneStatus), never by loading every task into memory and reducing
// over it in JS -- that pattern doesn't scale and was flagged in the audit
// on the old admin/users endpoint.
router.get('/projects/:id/roadmap', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const roadmap = await prisma.roadmap.findUnique({ where: { projectId: project.id } });
    if (!roadmap) return res.json({ hasRoadmap: project.hasRoadmap, roadmap: null, gates: [] });

    const gates = await prisma.gate.findMany({ where: { roadmapId: roadmap.id, deletedAt: null }, orderBy: { order: 'asc' } });
    const gateIds = gates.map((g) => g.id);
    const doneStatus = await prisma.status.findFirst({ where: { projectId: project.id, countsAsDone: true } });

    const [totalCounts, doneCounts] = await Promise.all([
      prisma.task.groupBy({
        by: ['gateId'],
        where: { projectId: project.id, deletedAt: null, gateId: { in: gateIds } },
        _count: { _all: true }
      }),
      doneStatus
        ? prisma.task.groupBy({
            by: ['gateId'],
            where: { projectId: project.id, deletedAt: null, gateId: { in: gateIds }, statusId: doneStatus.id },
            _count: { _all: true }
          })
        : Promise.resolve([])
    ]);

    const totalByGate = new Map(totalCounts.map((r) => [r.gateId, r._count._all]));
    const doneByGate = new Map(doneCounts.map((r) => [r.gateId, r._count._all]));

    const gatesWithProgress = gates.map((gate) => {
      const total = totalByGate.get(gate.id) || 0;
      const done = doneByGate.get(gate.id) || 0;
      return { ...gate, progress: { total, done, pct: total ? Math.round((done / total) * 100) : 0 } };
    });

    res.json({ hasRoadmap: true, roadmap, gates: gatesWithProgress });
  } catch (error) {
    next(error);
  }
});

export default router;
