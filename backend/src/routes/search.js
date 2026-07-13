import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// DocEntry doesn't exist in the schema yet (no Doc model was created in
// the Prompt 1 migration), so this covers Task + Project only. `docs: []`
// is returned so the frontend's result-grouping shape is already correct
// and adding real doc results later is a one-line addition here, not a
// response-shape change on the client.
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ query: q, results: { tasks: [], projects: [], docs: [] } });

    const [tasks, projects] = await Promise.all([
      prisma.task.findMany({
        where: {
          deletedAt: null,
          project: { ownerId: req.auth.sub, deletedAt: null },
          OR: [{ title: { contains: q, mode: 'insensitive' } }, { comment: { contains: q, mode: 'insensitive' } }]
        },
        include: {
          project: { select: { id: true, title: true } },
          gate: { select: { id: true, name: true } }
        },
        take: 25
      }),
      prisma.project.findMany({
        where: { ownerId: req.auth.sub, deletedAt: null, title: { contains: q, mode: 'insensitive' } },
        take: 25
      })
    ]);

    res.json({
      query: q,
      results: {
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          projectId: t.projectId,
          projectTitle: t.project.title,
          gateId: t.gateId,
          gateName: t.gate?.name ?? null
        })),
        projects: projects.map((p) => ({ id: p.id, title: p.title })),
        docs: []
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
