import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// DocEntry doesn't exist in the schema yet (no Doc model was created in
// the Prompt 1 migration), so this covers Task + Project only. `docs: []`
// is returned so the frontend's result-grouping shape is already correct
// and adding real doc results later is a one-line addition here, not a
// response-shape change on the client.
// Notes chats/messages are folded into one `notes` array, deduped by chat --
// a chat can match by its own title, by a message inside it, or both. Each
// entry carries an optional `snippet` (the first matching message's body,
// truncated) so the result list can show *why* it matched, same as tasks
// showing their project/gate context. Matching a chat or a message inside
// it both navigate to the same place (/notes/:id) since messages have no
// standalone view.
async function searchNotes(userId, q) {
  const [titleMatches, messageMatches] = await Promise.all([
    prisma.noteChat.findMany({
      where: { userId, deletedAt: null, title: { contains: q, mode: 'insensitive' } },
      select: { id: true, title: true },
      take: 25
    }),
    prisma.noteMessage.findMany({
      where: { deletedAt: null, chat: { userId, deletedAt: null }, body: { contains: q, mode: 'insensitive' } },
      select: { id: true, body: true, chatId: true, chat: { select: { title: true } } },
      take: 25
    })
  ]);

  const byId = new Map();
  for (const chat of titleMatches) {
    byId.set(chat.id, { id: chat.id, title: chat.title, snippet: null });
  }
  for (const msg of messageMatches) {
    const existing = byId.get(msg.chatId);
    const snippet = msg.body.length > 140 ? `${msg.body.slice(0, 140)}...` : msg.body;
    if (!existing) {
      byId.set(msg.chatId, { id: msg.chatId, title: msg.chat.title, snippet });
    } else if (!existing.snippet) {
      existing.snippet = snippet;
    }
  }
  return [...byId.values()];
}

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ query: q, results: { tasks: [], projects: [], docs: [], notes: [] } });

    const [tasks, projects, notes] = await Promise.all([
      prisma.task.findMany({
        where: {
          deletedAt: null,
          project: { ownerId: req.auth.sub, deletedAt: null },
          OR: [{ title: { contains: q, mode: 'insensitive' } }, { comment: { contains: q, mode: 'insensitive' } }]
        },
        include: {
          project: { select: { id: true, title: true } },
          gate: { select: { id: true, name: true } }
        },
        take: 25
      }),
      prisma.project.findMany({
        where: { ownerId: req.auth.sub, deletedAt: null, title: { contains: q, mode: 'insensitive' } },
        take: 25
      }),
      searchNotes(req.auth.sub, q)
    ]);

    res.json({
      query: q,
      results: {
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          customId: t.customId,
          projectId: t.projectId,
          projectTitle: t.project.title,
          gateId: t.gateId,
          gateName: t.gate?.name ?? null
        })),
        projects: projects.map((p) => ({ id: p.id, title: p.title })),
        docs: [],
        notes
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
