import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireTask, requirePromptVersion } from '../lib/ownership.js';

const router = Router();

const TARGET_TOOLS = ['FIGMA_AI', 'CLAUDE_CODE', 'FIGMA_MAKE', 'OTHER'];

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
        directionNote: req.body.directionNote?.trim() || null
      }
    });
    res.status(201).json(version);
  } catch (error) {
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
