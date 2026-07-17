import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { normalizeTaskInput, orderArray, projectInclude, serializeOrder, taskCounts, taskInputError, toClientProject } from '../utils/project.js';

const router = Router();

async function taskForUser(taskId, userId) {
  return prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, project: { ownerId: userId, deletedAt: null } },
    include: { project: { include: { groups: { where: { deletedAt: null } } } } }
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
    const inputError = taskInputError(req.body);
    if (inputError) return res.status(400).json({ message: inputError });
    const data = normalizeTaskInput(req.body);
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Nothing to update' });
    try {
      await prisma.task.update({ where: { id: task.id }, data });
    } catch (error) {
      // @@unique([projectId, customId]) -- surface a clean conflict instead
      // of letting the raw Prisma error fall through as a 500.
      if (error.code === 'P2002') {
        return res.status(409).json({ message: 'That ID is already used by another task in this project' });
      }
      throw error;
    }
    res.json(await projectPayload(task.projectId, req.auth.sub));
  } catch (error) {
    next(error);
  }
});

// Soft delete: only this task is deletedAt-stamped. Its Project is
// untouched, unlike the Project-delete cascade in projects.js.
router.delete('/:tid', async (req, res, next) => {
  try {
    const task = await taskForUser(req.params.tid, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    await prisma.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
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
