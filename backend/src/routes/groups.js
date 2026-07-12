import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { orderArray, projectInclude, serializeOrder, taskCounts, toClientProject } from '../utils/project.js';

const router = Router();

async function groupForUser(groupId, userId) {
  return prisma.group.findFirst({
    where: { id: groupId, project: { ownerId: userId } },
    include: { project: true, tasks: true }
  });
}

async function projectPayload(projectId, ownerId) {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId }, include: projectInclude });
  return { ...toClientProject(project), stats: taskCounts(project) };
}

router.patch('/:gid', async (req, res, next) => {
  try {
    const group = await groupForUser(req.params.gid, req.auth.sub);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const title = req.body.title?.trim();
    if (!title) return res.status(400).json({ message: 'Group title is required' });
    await prisma.group.update({ where: { id: group.id }, data: { title } });
    res.json(await projectPayload(group.projectId, req.auth.sub));
  } catch (error) {
    next(error);
  }
});

router.delete('/:gid', async (req, res, next) => {
  try {
    const group = await groupForUser(req.params.gid, req.auth.sub);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    await prisma.group.delete({ where: { id: group.id } });
    await prisma.project.update({
      where: { id: group.projectId },
      data: { order: serializeOrder(orderArray(group.project).filter((key) => key !== `group:${group.id}`)) }
    });
    res.json(await projectPayload(group.projectId, req.auth.sub));
  } catch (error) {
    next(error);
  }
});

router.post('/:gid/ungroup', async (req, res, next) => {
  try {
    const group = await groupForUser(req.params.gid, req.auth.sub);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const taskKeys = group.tasks.map((task) => `task:${task.id}`);
    const currentOrder = orderArray(group.project);
    const index = Math.max(0, currentOrder.indexOf(`group:${group.id}`));
    const order = currentOrder.filter((key) => key !== `group:${group.id}`);
    order.splice(index, 0, ...taskKeys);
    await prisma.$transaction([
      prisma.task.updateMany({ where: { groupId: group.id }, data: { groupId: null } }),
      prisma.group.delete({ where: { id: group.id } }),
      prisma.project.update({ where: { id: group.projectId }, data: { order: serializeOrder(order) } })
    ]);
    res.json(await projectPayload(group.projectId, req.auth.sub));
  } catch (error) {
    next(error);
  }
});

router.post('/merge', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.groupIds) ? req.body.groupIds : [];
    if (ids.length < 2) return res.status(400).json({ message: 'Choose at least two groups to merge' });
    const groups = await prisma.group.findMany({
      where: { id: { in: ids }, project: { ownerId: req.auth.sub } },
      include: { tasks: true, project: true }
    });
    if (groups.length !== ids.length) return res.status(404).json({ message: 'One or more groups were not found' });
    const projectId = groups[0].projectId;
    if (!groups.every((group) => group.projectId === projectId)) {
      return res.status(400).json({ message: 'Groups must belong to the same project' });
    }
    const title = req.body.title?.trim() || 'Merged group';
    const project = groups[0].project;
    const merged = await prisma.group.create({ data: { title, projectId } });
    const taskIds = groups.flatMap((group) => group.tasks.map((task) => task.id));
    const selected = new Set(ids.map((id) => `group:${id}`));
    const order = orderArray(project).filter((key) => !selected.has(key));
    order.unshift(`group:${merged.id}`);
    await prisma.$transaction([
      prisma.task.updateMany({ where: { id: { in: taskIds } }, data: { groupId: merged.id } }),
      prisma.group.deleteMany({ where: { id: { in: ids } } }),
      prisma.project.update({ where: { id: projectId }, data: { order: serializeOrder(order) } })
    ]);
    res.json(await projectPayload(projectId, req.auth.sub));
  } catch (error) {
    next(error);
  }
});

export default router;
