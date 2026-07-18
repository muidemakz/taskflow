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

export async function requireDocEntry(docId, userId) {
  return prisma.docEntry.findFirst({
    where: { id: docId, deletedAt: null, project: { ownerId: userId, deletedAt: null } },
    include: { project: true }
  });
}

export async function requireDocCategory(categoryId, userId) {
  return prisma.docCategory.findFirst({
    where: { id: categoryId, deletedAt: null, project: { ownerId: userId, deletedAt: null } },
    include: { project: true }
  });
}

export async function requirePromptVersion(promptVersionId, userId) {
  return prisma.promptVersion.findFirst({
    where: { id: promptVersionId, task: { deletedAt: null, project: { ownerId: userId, deletedAt: null } } },
    include: { task: true }
  });
}

// Notes: userId is the direct owner (not routed through a project), unlike
// every other helper above -- there is no shared-membership concept here,
// so this is the simplest possible check, but it's still centralized here
// rather than inlined per route for the same reason as everything else in
// this file.
export async function requireNoteChat(chatId, userId) {
  return prisma.noteChat.findFirst({ where: { id: chatId, userId, deletedAt: null } });
}

export async function requireNoteMessage(messageId, userId) {
  return prisma.noteMessage.findFirst({
    where: { id: messageId, deletedAt: null, chat: { userId, deletedAt: null } },
    include: { chat: true }
  });
}
