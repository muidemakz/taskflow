import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../lib/prisma.js';
import { requireTask, requirePromptVersion } from '../lib/ownership.js';

const router = Router();

const TARGET_TOOLS = ['FIGMA_AI', 'CLAUDE_CODE', 'FIGMA_MAKE', 'OTHER'];
const GENERATION_MODEL = 'claude-sonnet-4-6';
const GENERATION_SYSTEM_PROMPT =
  'You are a prompt engineering expert. Refine the given prompt for clarity, completeness, and effectiveness.';

// --- PromptVersion (append-only, same shape as TaskActivity) ---

router.get('/projects/:id/tasks/:taskId/prompts', async (req, res, next) => {
  try {
    const task = await requireTask(req.params.taskId, req.auth.sub);
    if (!task || task.projectId !== req.params.id) return res.status(404).json({ message: 'Task not found' });
    const versions = await prisma.promptVersion.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(versions);
  } catch (error) {
    next(error);
  }
});

// No update endpoint -- "changing" a prompt is always a new POST here.
router.post('/projects/:id/tasks/:taskId/prompts', async (req, res, next) => {
  try {
    const task = await requireTask(req.params.taskId, req.auth.sub);
    if (!task || task.projectId !== req.params.id) return res.status(404).json({ message: 'Task not found' });

    const body = req.body.body;
    if (typeof body !== 'string' || !body.trim()) return res.status(400).json({ message: 'Body is required' });
    if (!TARGET_TOOLS.includes(req.body.targetTool)) return res.status(400).json({ message: 'targetTool must be one of ' + TARGET_TOOLS.join(', ') });

    // USED is only reachable via the mark-as-used endpoint, never at creation.
    let status = 'DRAFT';
    if (req.body.status) {
      if (!['DRAFT', 'FINAL'].includes(req.body.status)) return res.status(400).json({ message: 'status must be DRAFT or FINAL' });
      status = req.body.status;
    }

    const version = await prisma.promptVersion.create({
      data: {
        taskId: task.id,
        body,
        targetTool: req.body.targetTool,
        status,
        directionNote: req.body.directionNote?.trim() || null,
        generated: req.body.generated === true
      }
    });
    res.status(201).json(version);
  } catch (error) {
    next(error);
  }
});

// AI generation (Prompt 6) -- purely additive on top of the manual system
// above. Disabled by default; when off or on any failure the manual
// create/change/copy/mark-used flow is completely unaffected.
router.post('/prompts/generate', async (req, res, next) => {
  try {
    if (process.env.ENABLE_AI_GENERATION !== 'true') {
      return res.status(403).json({ message: 'AI generation disabled' });
    }

    const task = await requireTask(req.body.taskId, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const [gate, currentVersion, docLinks] = await Promise.all([
      task.gateId ? prisma.gate.findUnique({ where: { id: task.gateId } }) : null,
      prisma.promptVersion.findFirst({ where: { taskId: task.id }, orderBy: { createdAt: 'desc' } }),
      prisma.taskDocLink.findMany({ where: { taskId: task.id }, include: { docEntry: true } })
    ]);

    const sections = [`Task: ${task.title}`];
    if (task.comment) sections.push(`Description: ${task.comment}`);
    sections.push(`Gate: ${gate ? gate.name : 'Unscheduled'}`);
    if (docLinks.length) {
      const docs = docLinks.map((link) => `- ${link.docEntry.title}\n${link.docEntry.body}`).join('\n\n');
      sections.push(`Linked docs:\n${docs}`);
    }
    if (currentVersion) {
      sections.push(`Current prompt draft:\n${currentVersion.body}\n\nRefine this prompt using the task context above.`);
    } else {
      sections.push('There is no existing prompt for this task yet. Draft an initial prompt using the context above.');
    }
    sections.push('Return only the prompt text -- no preamble, no explanation, no surrounding quotes.');

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 2048,
      system: GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: sections.join('\n\n') }]
    });

    const text = response.content.find((block) => block.type === 'text')?.text?.trim();
    if (!text) return res.status(502).json({ message: 'Generation failed' });
    res.json({ body: text });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return res.status(502).json({ message: 'Generation failed' });
    }
    next(error);
  }
});

router.patch('/prompts/:id/mark-used', async (req, res, next) => {
  try {
    const version = await requirePromptVersion(req.params.id, req.auth.sub);
    if (!version) return res.status(404).json({ message: 'Prompt version not found' });
    const updated = await prisma.promptVersion.update({
      where: { id: version.id },
      data: { status: 'USED', usedAt: new Date() }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
