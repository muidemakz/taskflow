import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';

// Same mock-enforces-the-real-where-clause-contract convention as
// trashDelete.test.js: a chat/message only comes back when the mock's
// where-clause matches the row's true owner, so if a route ever drops its
// ownership scope, the negative tests below start failing instead of
// silently passing.
const OWNER = 'user-b';
const ATTACKER = 'user-a';
const OWNED_CHAT = { id: 'chat-1', userId: OWNER, title: null, aiEnabled: false, projectId: null, taskId: null, deletedAt: null };
const OWNED_MESSAGE = { id: 'msg-1', chatId: OWNED_CHAT.id, role: 'user', body: 'hello', deletedAt: null };

const anthropicCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    constructor() {
      this.messages = { create: anthropicCreate };
    }
  }
  MockAnthropic.APIError = class extends Error {};
  return { default: MockAnthropic };
});

const prismaMock = vi.hoisted(() => ({
  noteChat: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  noteMessage: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  project: { findFirst: vi.fn() },
  task: { findFirst: vi.fn() }
}));

vi.mock('../src/lib/prisma.js', () => ({ default: prismaMock }));

import notesRouter from '../src/routes/notes.js';

let server;
let baseUrl;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    (req, _res, next) => {
      req.auth = { sub: req.headers['x-test-user'] };
      next();
    },
    notesRouter
  );
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

function chatWhereMatches(where, chat) {
  return where?.id === chat.id && where?.userId === chat.userId && !where?.deletedAt === !chat.deletedAt;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ENABLE_AI_GENERATION;

  prismaMock.noteChat.findFirst.mockImplementation(async ({ where }) =>
    chatWhereMatches(where, OWNED_CHAT) ? { ...OWNED_CHAT } : null
  );
  prismaMock.noteMessage.findFirst.mockImplementation(async ({ where }) => {
    if (where?.id !== OWNED_MESSAGE.id) return null;
    return where?.chat?.userId === OWNER ? { ...OWNED_MESSAGE, chat: { ...OWNED_CHAT } } : null;
  });
  prismaMock.noteChat.update.mockImplementation(async ({ where, data }) => ({ ...OWNED_CHAT, ...data, id: where.id }));
  prismaMock.noteMessage.update.mockImplementation(async ({ where, data }) => ({ ...OWNED_MESSAGE, ...data, id: where.id }));
  prismaMock.noteMessage.create.mockImplementation(async ({ data }) => ({
    id: `generated-${data.role}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data
  }));
  prismaMock.noteMessage.findMany.mockResolvedValue([{ ...OWNED_MESSAGE }]);
  prismaMock.noteChat.findMany.mockResolvedValue([OWNED_CHAT]);
  prismaMock.noteChat.create.mockImplementation(async ({ data }) => ({
    id: 'new-chat',
    aiEnabled: false,
    projectId: null,
    taskId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data
  }));
});

function call(method, path, { asUser, body } = {}) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { 'x-test-user': asUser, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}

describe('ownership -- negative path (cross-user access is 404, not 403)', () => {
  it("rejects user A reading user B's chat detail with 404", async () => {
    const res = await call('GET', `/notes/chats/${OWNED_CHAT.id}`, { asUser: ATTACKER });
    expect(res.status).toBe(404);
  });

  it("rejects user A reading user B's chat messages with 404 and never lists messages", async () => {
    const res = await call('GET', `/notes/chats/${OWNED_CHAT.id}/messages`, { asUser: ATTACKER });
    expect(res.status).toBe(404);
    expect(prismaMock.noteMessage.findMany).not.toHaveBeenCalled();
  });

  it("rejects user A renaming user B's chat with 404 and never updates it", async () => {
    const res = await call('PATCH', `/notes/chats/${OWNED_CHAT.id}`, { asUser: ATTACKER, body: { title: 'hijacked' } });
    expect(res.status).toBe(404);
    expect(prismaMock.noteChat.update).not.toHaveBeenCalled();
  });

  it("rejects user A deleting user B's chat with 404", async () => {
    const res = await call('DELETE', `/notes/chats/${OWNED_CHAT.id}`, { asUser: ATTACKER });
    expect(res.status).toBe(404);
    expect(prismaMock.noteChat.update).not.toHaveBeenCalled();
  });

  it("rejects user A sending a message into user B's chat with 404", async () => {
    const res = await call('POST', `/notes/chats/${OWNED_CHAT.id}/messages`, { asUser: ATTACKER, body: { body: 'hi' } });
    expect(res.status).toBe(404);
    expect(prismaMock.noteMessage.create).not.toHaveBeenCalled();
  });

  it("rejects user A editing user B's message with 404", async () => {
    const res = await call('PATCH', `/notes/messages/${OWNED_MESSAGE.id}`, { asUser: ATTACKER, body: { body: 'edited' } });
    expect(res.status).toBe(404);
    expect(prismaMock.noteMessage.update).not.toHaveBeenCalled();
  });

  it("rejects user A deleting user B's message with 404", async () => {
    const res = await call('DELETE', `/notes/messages/${OWNED_MESSAGE.id}`, { asUser: ATTACKER });
    expect(res.status).toBe(404);
    expect(prismaMock.noteMessage.update).not.toHaveBeenCalled();
  });

  it('lets the real owner do all of the above', async () => {
    const getRes = await call('GET', `/notes/chats/${OWNED_CHAT.id}/messages`, { asUser: OWNER });
    expect(getRes.status).toBe(200);
    const patchRes = await call('PATCH', `/notes/chats/${OWNED_CHAT.id}`, { asUser: OWNER, body: { title: 'My notes' } });
    expect(patchRes.status).toBe(200);
  });
});

describe('POST /notes/chats/:id/messages -- aiEnabled + ENABLE_AI_GENERATION two-gate behavior', () => {
  it('aiEnabled false: persists the user message only, no assistant reply, no AI call', async () => {
    prismaMock.noteChat.findFirst.mockResolvedValueOnce({ ...OWNED_CHAT, aiEnabled: false });
    const res = await call('POST', `/notes/chats/${OWNED_CHAT.id}/messages`, { asUser: OWNER, body: { body: 'just a note' } });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.assistantMessage).toBeNull();
    expect(json.aiNotice).toBeNull();
    expect(prismaMock.noteMessage.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.noteMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: 'user', body: 'just a note' }) }));
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it('aiEnabled true but ENABLE_AI_GENERATION off: message saves, clear aiNotice, no error, no AI call', async () => {
    process.env.ENABLE_AI_GENERATION = 'false';
    prismaMock.noteChat.findFirst.mockResolvedValueOnce({ ...OWNED_CHAT, aiEnabled: true });
    const res = await call('POST', `/notes/chats/${OWNED_CHAT.id}/messages`, { asUser: OWNER, body: { body: 'ask the AI' } });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.assistantMessage).toBeNull();
    expect(json.aiNotice).toMatch(/disabled/i);
    expect(prismaMock.noteMessage.create).toHaveBeenCalledTimes(1);
    expect(anthropicCreate).not.toHaveBeenCalled();
  });

  it('aiEnabled true AND ENABLE_AI_GENERATION on: persists user message, calls the AI, persists and returns the reply', async () => {
    // This only flips the flag inside this test process, never the real
    // staging environment variable -- proves the full code path works
    // without ever enabling AI generation for real users.
    process.env.ENABLE_AI_GENERATION = 'true';
    prismaMock.noteChat.findFirst.mockResolvedValueOnce({ ...OWNED_CHAT, aiEnabled: true });
    anthropicCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Here is a reply.' }] });

    const res = await call('POST', `/notes/chats/${OWNED_CHAT.id}/messages`, { asUser: OWNER, body: { body: 'ask the AI' } });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.aiNotice).toBeNull();
    expect(json.assistantMessage).toMatchObject({ role: 'assistant', body: 'Here is a reply.' });
    expect(anthropicCreate).toHaveBeenCalledTimes(1);
    expect(anthropicCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-sonnet-4-6' }));
    expect(prismaMock.noteMessage.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.noteMessage.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ role: 'assistant', body: 'Here is a reply.' }) }));
  });

  it('rejects an empty body with 400 before touching the database', async () => {
    const res = await call('POST', `/notes/chats/${OWNED_CHAT.id}/messages`, { asUser: OWNER, body: { body: '   ' } });
    expect(res.status).toBe(400);
    expect(prismaMock.noteMessage.create).not.toHaveBeenCalled();
  });
});

describe('POST /notes/chats', () => {
  it('creates a chat scoped to the authed user with aiEnabled defaulting false', async () => {
    const res = await call('POST', '/notes/chats', { asUser: OWNER, body: {} });
    expect(res.status).toBe(201);
    expect(prismaMock.noteChat.create).toHaveBeenCalledWith({ data: { userId: OWNER, title: null } });
  });
});
