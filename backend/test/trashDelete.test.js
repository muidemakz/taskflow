import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';

// The route's ownership guarantee lives entirely in the where-clause it
// hands Prisma, so the mock enforces the same contract the real DB would:
// a row only comes back when the query is scoped to the row's true owner.
// If the route ever drops the ownership scope, the lookup here returns the
// row for the wrong user and the negative tests below fail.
const OWNER = 'user-b';
const ATTACKER = 'user-a';
const TRASHED_TASK = { id: 'task-1', ownerId: OWNER };
const TRASHED_PROJECT = { id: 'project-1', ownerId: OWNER };
const TRASHED_NOTECHAT = { id: 'notechat-1', userId: OWNER };

const prismaMock = vi.hoisted(() => ({
  task: { findFirst: vi.fn(), delete: vi.fn() },
  project: { findFirst: vi.fn(), delete: vi.fn() },
  noteChat: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() }
}));

vi.mock('../src/lib/prisma.js', () => ({ default: prismaMock }));

import trashRouter from '../src/routes/trash.js';

let server;
let baseUrl;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/trash',
    (req, _res, next) => {
      req.auth = { sub: req.headers['x-test-user'] };
      next();
    },
    trashRouter
  );
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.task.findFirst.mockImplementation(async ({ where }) =>
    where?.id === TRASHED_TASK.id && where?.deletedAt && where?.project?.ownerId === TRASHED_TASK.ownerId
      ? { id: TRASHED_TASK.id }
      : null
  );
  prismaMock.project.findFirst.mockImplementation(async ({ where }) =>
    where?.id === TRASHED_PROJECT.id && where?.deletedAt && where?.ownerId === TRASHED_PROJECT.ownerId
      ? { id: TRASHED_PROJECT.id }
      : null
  );
  prismaMock.noteChat.findFirst.mockImplementation(async ({ where }) =>
    where?.id === TRASHED_NOTECHAT.id && where?.deletedAt && where?.userId === TRASHED_NOTECHAT.userId
      ? { id: TRASHED_NOTECHAT.id }
      : null
  );
  prismaMock.task.delete.mockResolvedValue({});
  prismaMock.project.delete.mockResolvedValue({});
  prismaMock.noteChat.update.mockResolvedValue({});
  prismaMock.noteChat.delete.mockResolvedValue({});
});

function del(type, id, asUser) {
  return fetch(`${baseUrl}/api/trash/${type}/${id}`, {
    method: 'DELETE',
    headers: { 'x-test-user': asUser }
  });
}

function restore(type, id, asUser) {
  return fetch(`${baseUrl}/api/trash/${type}/${id}/restore`, {
    method: 'POST',
    headers: { 'x-test-user': asUser }
  });
}

describe('DELETE /api/trash/:type/:id ownership', () => {
  it("rejects user A permanently deleting user B's trashed task with 404 and never touches the row", async () => {
    const res = await del('task', TRASHED_TASK.id, ATTACKER);
    expect(res.status).toBe(404);
    expect(prismaMock.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ project: expect.objectContaining({ ownerId: ATTACKER }) })
      })
    );
    expect(prismaMock.task.delete).not.toHaveBeenCalled();
  });

  it("rejects user A permanently deleting user B's trashed project with 404", async () => {
    const res = await del('project', TRASHED_PROJECT.id, ATTACKER);
    expect(res.status).toBe(404);
    expect(prismaMock.project.delete).not.toHaveBeenCalled();
  });

  it('lets the owner permanently delete their own trashed task', async () => {
    const res = await del('task', TRASHED_TASK.id, OWNER);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 'task', id: TRASHED_TASK.id });
    expect(prismaMock.task.delete).toHaveBeenCalledWith({ where: { id: TRASHED_TASK.id } });
  });

  it('rejects an unknown type with 400 without querying anything', async () => {
    const res = await del('workspace', 'whatever', OWNER);
    expect(res.status).toBe(400);
    expect(prismaMock.task.delete).not.toHaveBeenCalled();
    expect(prismaMock.project.delete).not.toHaveBeenCalled();
  });
});

describe('notechat trash ownership', () => {
  it("rejects user A permanently deleting user B's trashed note chat with 404 and never touches the row", async () => {
    const res = await del('notechat', TRASHED_NOTECHAT.id, ATTACKER);
    expect(res.status).toBe(404);
    expect(prismaMock.noteChat.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: ATTACKER }) })
    );
    expect(prismaMock.noteChat.delete).not.toHaveBeenCalled();
  });

  it("rejects user A restoring user B's trashed note chat with 404", async () => {
    const res = await restore('notechat', TRASHED_NOTECHAT.id, ATTACKER);
    expect(res.status).toBe(404);
    expect(prismaMock.noteChat.update).not.toHaveBeenCalled();
  });

  it('lets the owner restore their own trashed note chat', async () => {
    const res = await restore('notechat', TRASHED_NOTECHAT.id, OWNER);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ restored: 'notechat', id: TRASHED_NOTECHAT.id });
    expect(prismaMock.noteChat.update).toHaveBeenCalledWith({ where: { id: TRASHED_NOTECHAT.id }, data: { deletedAt: null } });
  });

  it('lets the owner permanently delete their own trashed note chat, relying on the FK cascade to clean up its messages', async () => {
    const res = await del('notechat', TRASHED_NOTECHAT.id, OWNER);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 'notechat', id: TRASHED_NOTECHAT.id });
    // NoteMessage.chatId is onDelete: Cascade in schema.prisma -- a single
    // delete on the chat row is the entire fix; there is no separate
    // messages.deleteMany to assert here because the DB does that part.
    expect(prismaMock.noteChat.delete).toHaveBeenCalledWith({ where: { id: TRASHED_NOTECHAT.id } });
  });
});
