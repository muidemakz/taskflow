import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireProject, requireTag } from '../lib/ownership.js';

const router = Router();

router.get('/projects/:id/tags', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const tags = await prisma.tag.findMany({ where: { projectId: project.id, deletedAt: null }, orderBy: { name: 'asc' } });
    res.json(tags);
  } catch (error) {
    next(error);
  }
});

router.post('/projects/:id/tags', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: 'Tag name is required' });
    const tag = await prisma.tag.upsert({
      where: { projectId_name: { projectId: project.id, name } },
      update: { deletedAt: null },
      create: { projectId: project.id, name }
    });
    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
});

router.delete('/tags/:tagId', async (req, res, next) => {
  try {
    const tag = await requireTag(req.params.tagId, req.auth.sub);
    if (!tag) return res.status(404).json({ message: 'Tag not found' });
    await prisma.tag.update({ where: { id: tag.id }, data: { deletedAt: new Date() } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
