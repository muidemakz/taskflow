import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { defaultOrder, orderArray, projectInclude, serializeOrder, taskCounts, toClientProject } from '../utils/project.js';

const router = Router();

async function ownedProject(id, ownerId) {
  return prisma.project.findFirst({ where: { id, ownerId }, include: projectInclude });
}

router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: req.auth.sub },
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
    const project = await prisma.project.create({
      data: { title, description: req.body.description?.trim() || null, ownerId: req.auth.sub, order: serializeOrder([]) },
      include: projectInclude
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
    const updated = await prisma.project.update({ where: { id: project.id }, data, include: projectInclude });
    res.json({ ...toClientProject(updated), stats: taskCounts(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const project = await ownedProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    await prisma.project.delete({ where: { id: project.id } });
    res.status(204).end();
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
    const task = await prisma.task.create({
      data: { title, projectId: project.id, groupId, priority }
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
