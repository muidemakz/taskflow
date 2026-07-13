import prisma from './prisma.js';

// Every lookup below routes ownership through this one module instead of
// inlining `ownerId === userId` per query, so a future membership model
// only needs changing these functions, not every route file.

export async function requireProject(projectId, userId) {
  return prisma.project.findFirst({ where: { id: projectId, ownerId: userId, deletedAt: null } });
}

export async function requireRoadmap(projectId, userId) {
  const project = await requireProject(projectId, userId);
  if (!project) return null;
  return prisma.roadmap.findUnique({ where: { projectId }, include: { project: true } });
}

export async function requireStatus(statusId, userId) {
  return prisma.status.findFirst({
    where: { id: statusId, project: { ownerId: userId, deletedAt: null } },
    include: { project: true }
  });
}

export async function requireGate(gateId, userId) {
  return prisma.gate.findFirst({
    where: { id: gateId, deletedAt: null, roadmap: { project: { ownerId: userId, deletedAt: null } } },
    include: { roadmap: { include: { project: true } } }
  });
}

export async function requireTask(taskId, userId) {
  return prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, project: { ownerId: userId, deletedAt: null } },
    include: { project: true }
  });
}

export async function requireTag(tagId, userId) {
  return prisma.tag.findFirst({
    where: { id: tagId, deletedAt: null, project: { ownerId: userId, deletedAt: null } },
    include: { project: true }
  });
}
