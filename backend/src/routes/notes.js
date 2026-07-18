import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../lib/prisma.js';
import { requireNoteChat, requireNoteMessage, requireProject, requireTask } from '../lib/ownership.js';

const router = Router();

// Same model/system-prompt-per-feature convention as prompts.js's Prompt 6
// generation -- a distinct system prompt for notes-chat rather than reusing
// the prompt-refinement one, but the same model and client construction.
const GENERATION_MODEL = 'claude-sonnet-4-6';
const GENERATION_SYSTEM_PROMPT =
  'You are a helpful assistant inside a personal notes app. Reply conversationally and concisely to the user\'s notes.';

function serializeChat(chat) {
  return {
    id: chat.id,
    title: chat.title,
    aiEnabled: chat.aiEnabled,
    projectId: chat.projectId,
    taskId: chat.taskId,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt
  };
}

function serializeMessage(message) {
  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role,
    body: message.body,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };
}

router.post('/notes/chats', async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() || null : null;
    const chat = await prisma.noteChat.create({
      data: { userId: req.auth.sub, title }
    });
    res.status(201).json(serializeChat(chat));
  } catch (error) {
    next(error);
  }
});

router.get('/notes/chats', async (req, res, next) => {
  try {
    const chats = await prisma.noteChat.findMany({
      where: { userId: req.auth.sub, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    // Newest first, per spec -- "Untitled N" numbering is a separate concern
    // (creation order), computed client-side from createdAt so it stays
    // correct regardless of this list's sort order.
    res.json(chats.map(serializeChat));
  } catch (error) {
    next(error);
  }
});

// Not in the original route list -- added because the chat page needs this
// chat's title/aiEnabled on its own, and refetching the whole list just to
// find one row by id would be wasteful. Same ownership pattern as every
// other single-resource lookup here.
router.get('/notes/chats/:id', async (req, res, next) => {
  try {
    const chat = await requireNoteChat(req.params.id, req.auth.sub);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    res.json(serializeChat(chat));
  } catch (error) {
    next(error);
  }
});

router.patch('/notes/chats/:id', async (req, res, next) => {
  try {
    const chat = await requireNoteChat(req.params.id, req.auth.sub);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const data = {};
    if (typeof req.body.title === 'string') data.title = req.body.title.trim() || null;
    if (typeof req.body.aiEnabled === 'boolean') data.aiEnabled = req.body.aiEnabled;
    if ('projectId' in req.body) {
      if (req.body.projectId === null) {
        data.projectId = null;
      } else {
        const project = await requireProject(req.body.projectId, req.auth.sub);
        if (!project) return res.status(400).json({ message: 'projectId does not belong to this user' });
        data.projectId = project.id;
      }
    }
    if ('taskId' in req.body) {
      if (req.body.taskId === null) {
        data.taskId = null;
      } else {
        const task = await requireTask(req.body.taskId, req.auth.sub);
        if (!task) return res.status(400).json({ message: 'taskId does not belong to this user' });
        data.taskId = task.id;
      }
    }
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Nothing to update' });

    const updated = await prisma.noteChat.update({ where: { id: chat.id }, data });
    res.json(serializeChat(updated));
  } catch (error) {
    next(error);
  }
});

router.delete('/notes/chats/:id', async (req, res, next) => {
  try {
    const chat = await requireNoteChat(req.params.id, req.auth.sub);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    await prisma.noteChat.update({ where: { id: chat.id }, data: { deletedAt: new Date() } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/notes/chats/:id/messages', async (req, res, next) => {
  try {
    const chat = await requireNoteChat(req.params.id, req.auth.sub);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    const messages = await prisma.noteMessage.findMany({
      where: { chatId: chat.id, deletedAt: null },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages.map(serializeMessage));
  } catch (error) {
    next(error);
  }
});

// Always persists the user message first, regardless of what happens next --
// a failed/disabled AI call must never lose the note itself. Three distinct
// outcomes after that, matching the spec's two-gate design (per-chat
// aiEnabled, then the global ENABLE_AI_GENERATION flag, same gate order as
// Prompt 6's requireTask-then-flag-check -- here the flag is checked second
// since the chat's own setting is the more specific, per-resource gate):
//   1. aiEnabled false            -> user message only, no aiNotice
//   2. aiEnabled true, flag off   -> user message only, aiNotice explaining why
//   3. aiEnabled true, flag on    -> user message + a real assistant reply
router.post('/notes/chats/:id/messages', async (req, res, next) => {
  try {
    const chat = await requireNoteChat(req.params.id, req.auth.sub);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body) return res.status(400).json({ message: 'body is required' });

    const userMessage = await prisma.noteMessage.create({
      data: { chatId: chat.id, role: 'user', body }
    });
    await prisma.noteChat.update({ where: { id: chat.id }, data: { updatedAt: new Date() } });

    if (!chat.aiEnabled) {
      return res.status(201).json({ userMessage: serializeMessage(userMessage), assistantMessage: null, aiNotice: null });
    }

    if (process.env.ENABLE_AI_GENERATION !== 'true') {
      return res.status(201).json({
        userMessage: serializeMessage(userMessage),
        assistantMessage: null,
        aiNotice: 'AI replies are currently disabled for this app. Your message was saved.'
      });
    }

    const history = await prisma.noteMessage.findMany({
      where: { chatId: chat.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 50
    });

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: GENERATION_MODEL,
        max_tokens: 1024,
        system: GENERATION_SYSTEM_PROMPT,
        messages: history.map((m) => ({ role: m.role, content: m.body }))
      });
      const text = response.content.find((block) => block.type === 'text')?.text?.trim();
      if (!text) {
        return res.status(201).json({
          userMessage: serializeMessage(userMessage),
          assistantMessage: null,
          aiNotice: 'The AI did not return a reply. Your message was saved.'
        });
      }
      const assistantMessage = await prisma.noteMessage.create({
        data: { chatId: chat.id, role: 'assistant', body: text }
      });
      res.status(201).json({ userMessage: serializeMessage(userMessage), assistantMessage: serializeMessage(assistantMessage), aiNotice: null });
    } catch (aiError) {
      if (aiError instanceof Anthropic.APIError) {
        return res.status(201).json({
          userMessage: serializeMessage(userMessage),
          assistantMessage: null,
          aiNotice: 'The AI reply failed. Your message was saved.'
        });
      }
      throw aiError;
    }
  } catch (error) {
    next(error);
  }
});

router.patch('/notes/messages/:id', async (req, res, next) => {
  try {
    const message = await requireNoteMessage(req.params.id, req.auth.sub);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body) return res.status(400).json({ message: 'body is required' });
    const updated = await prisma.noteMessage.update({ where: { id: message.id }, data: { body } });
    res.json(serializeMessage(updated));
  } catch (error) {
    next(error);
  }
});

router.delete('/notes/messages/:id', async (req, res, next) => {
  try {
    const message = await requireNoteMessage(req.params.id, req.auth.sub);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    await prisma.noteMessage.update({ where: { id: message.id }, data: { deletedAt: new Date() } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
