import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { normalizeTaskInput, orderArray, projectInclude, serializeOrder, taskCounts, toClientProject } from '../utils/project.js';

const router = Router();

async function taskForUser(taskId, userId) {
  return prisma.task.findFirst({
    where: { id: taskId, project: { ownerId: userId } },
    include: { project: { include: { groups: true } } }
  });
}

async function projectPayload(projectId, ownerId) {
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId }, include: projectInclude });
  return { ...toClientProject(project), stats: taskCounts(project) };
}

router.patch('/:tid', async (req, res, next) => {
  try {
    const task = await taskForUser(req.params.tid, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const data = normalizeTaskInput(req.body);
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Nothing to update' });
    await prisma.task.update({ where: { id: task.id }, data });
    res.json(await projectPayload(task.projectId, req.auth.sub));
  } catch (error) {
    next(error);
  }
});

router.delete('/:tid', async (req, res, next) => {
  try {
    const task = await taskForUser(req.params.tid, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    await prisma.task.delete({ where: { id: task.id } });
    await prisma.project.update({
      where: { id: task.projectId },
      data: { order: serializeOrder(orderArray(task.project).filter((key) => key !== `task:${task.id}`)) }
    });
    res.json(await projectPayload(task.projectId, req.auth.sub));
  } catch (error) {
    next(error);
  }
});

router.patch('/:tid/move', async (req, res, next) => {
  try {
    const task = await taskForUser(req.params.tid, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const groupId = req.body.groupId || null;
    if (groupId && !task.project.groups.some((group) => group.id === groupId)) {
      return res.status(400).json({ message: 'Group does not belong to this project' });
    }
    await prisma.task.update({ where: { id: task.id }, data: { groupId } });
    const currentOrder = orderArray(task.project);
    const order = groupId ? currentOrder.filter((key) => key !== `task:${task.id}`) : [`task:${task.id}`, ...currentOrder.filter((key) => key !== `task:${task.id}`)];
    await prisma.project.update({ where: { id: task.projectId }, data: { order: serializeOrder(order) } });
    res.json(await projectPayload(task.projectId, req.auth.sub));
  } catch (error) {
    next(error);
  }
});

export default router;
