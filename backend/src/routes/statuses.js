import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireProject, requireStatus } from '../lib/ownership.js';
import { resolveCountsAsDoneChange, validateCountsAsDoneInvariant } from '../lib/statusGuard.js';

const router = Router();

router.get('/projects/:id/statuses', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const statuses = await prisma.status.findMany({ where: { projectId: project.id }, orderBy: { order: 'asc' } });
    res.json(statuses);
  } catch (error) {
    next(error);
  }
});

router.post('/projects/:id/statuses', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: 'Status name is required' });
    const countsAsDone = Boolean(req.body.countsAsDone);
    const order = Number.isInteger(req.body.order)
      ? req.body.order
      : (await prisma.status.aggregate({ where: { projectId: project.id }, _max: { order: true } }))._max.order ?? -1;

    const existing = await prisma.status.findMany({ where: { projectId: project.id } });
    const { toFalse } = resolveCountsAsDoneChange(existing, null, countsAsDone);

    const status = await prisma.$transaction(async (tx) => {
      if (toFalse.length) await tx.status.updateMany({ where: { id: { in: toFalse } }, data: { countsAsDone: false } });
      return tx.status.create({ data: { projectId: project.id, name, order: order + 1, countsAsDone } });
    });
    res.status(201).json(status);
  } catch (error) {
    next(error);
  }
});

router.patch('/statuses/:statusId', async (req, res, next) => {
  try {
    const status = await requireStatus(req.params.statusId, req.auth.sub);
    if (!status) return res.status(404).json({ message: 'Status not found' });

    const data = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) data.name = req.body.name.trim();
    if (Number.isInteger(req.body.order)) data.order = req.body.order;

    let toFalse = [];
    if (typeof req.body.countsAsDone === 'boolean') {
      const existing = await prisma.status.findMany({ where: { projectId: status.projectId } });
      const invalidReason = validateCountsAsDoneInvariant(existing, status.id, req.body.countsAsDone);
      if (invalidReason) return res.status(400).json({ message: invalidReason });
      data.countsAsDone = req.body.countsAsDone;
      toFalse = resolveCountsAsDoneChange(existing, status.id, req.body.countsAsDone).toFalse;
    }

    if (!Object.keys(data).length) return res.status(400).json({ message: 'Nothing to update' });

    const updated = await prisma.$transaction(async (tx) => {
      if (toFalse.length) await tx.status.updateMany({ where: { id: { in: toFalse } }, data: { countsAsDone: false } });
      return tx.status.update({ where: { id: status.id }, data });
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/statuses/:statusId', async (req, res, next) => {
  try {
    const status = await requireStatus(req.params.statusId, req.auth.sub);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    const inUse = await prisma.task.count({ where: { statusId: status.id, deletedAt: null } });
    if (inUse > 0) {
      return res.status(400).json({ message: `${inUse} task(s) still use this status. Move them first.` });
    }
    await prisma.status.delete({ where: { id: status.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
