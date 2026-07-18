import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireProject, requireTask } from '../lib/ownership.js';
import { appendPosition } from '../lib/position.js';
import { logActivity } from '../lib/activity.js';
import { createTaskWithCustomId } from '../utils/customId.js';

const router = Router();

// Create-or-update keyed on (source, externalId): an agent syncing daily
// re-sends the same items and gets updates, not duplicates. New imports
// land in the target project's first non-done status (lowest `order`
// among non-countsAsDone statuses) with no gate (Unscheduled), pending
// human triage.
//
// Hard boundary: this may update title/sourceUrl on an existing
// externally-sourced task, but must NEVER change its status after
// creation. Status changes from sync go exclusively through the proposal
// endpoints below.
router.post('/tasks', async (req, res, next) => {
  try {
    const { projectId, externalId, title, sourceUrl } = req.body;
    const source = req.body.source?.trim();
    if (!projectId || !source || !externalId || !title?.trim()) {
      return res.status(400).json({ message: 'projectId, source, externalId, and title are required' });
    }
    const project = await requireProject(projectId, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const existing = await prisma.task.findUnique({ where: { source_externalId: { source, externalId } } });

    if (existing) {
      if (existing.projectId !== project.id) {
        return res.status(409).json({ message: 'This (source, externalId) already belongs to a different project' });
      }
      const updated = await prisma.task.update({
        where: { id: existing.id },
        data: { title: title.trim(), sourceUrl: sourceUrl || existing.sourceUrl }
      });
      return res.json({ created: false, task: updated });
    }

    const firstNonDoneStatus = await prisma.status.findFirst({
      where: { projectId: project.id, countsAsDone: false },
      orderBy: { order: 'asc' }
    });
    if (!firstNonDoneStatus) return res.status(400).json({ message: 'Project has no non-done status to land new tasks in' });

    const maxPosition = (await prisma.task.aggregate({ where: { statusId: firstNonDoneStatus.id }, _max: { position: true } }))._max.position;

    const created = await createTaskWithCustomId(prisma, project.id, null, {
      projectId: project.id,
      title: title.trim(),
      statusId: firstNonDoneStatus.id,
      gateId: null,
      position: appendPosition(maxPosition),
      source,
      externalId,
      sourceUrl: sourceUrl || null
    });
    res.status(201).json({ created: true, task: created });
  } catch (error) {
    next(error);
  }
});

// Creating a proposal never mutates the task. Duplicate-pending detection:
// same task + same proposed status with status PENDING returns the
// existing proposal instead of stacking copies.
router.post('/proposals', async (req, res, next) => {
  try {
    const { taskId, proposedStatusId, reason, sourceUrl } = req.body;
    const source = req.body.source?.trim();
    if (!taskId || !proposedStatusId || !reason?.trim() || !source) {
      return res.status(400).json({ message: 'taskId, proposedStatusId, reason, and source are required' });
    }
    const task = await requireTask(taskId, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const status = await prisma.status.findFirst({ where: { id: proposedStatusId, projectId: task.projectId } });
    if (!status) return res.status(400).json({ message: 'proposedStatusId does not belong to this task\'s project' });

    const existingPending = await prisma.syncProposal.findFirst({
      where: { taskId: task.id, proposedStatusId: status.id, status: 'PENDING' }
    });
    if (existingPending) return res.status(200).json(existingPending);

    const proposal = await prisma.syncProposal.create({
      data: { taskId: task.id, proposedStatusId: status.id, reason: reason.trim(), source, sourceUrl: sourceUrl || null }
    });
    res.status(201).json(proposal);
  } catch (error) {
    next(error);
  }
});

router.get('/proposals', async (req, res, next) => {
  try {
    const status = req.query.status || 'PENDING';
    const proposals = await prisma.syncProposal.findMany({
      where: { status, task: { project: { ownerId: req.auth.sub } } },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
            statusId: true,
            project: { select: { title: true } },
            taskStatus: { select: { id: true, name: true } }
          }
        },
        proposedStatus: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(proposals);
  } catch (error) {
    next(error);
  }
});

// Applies the status move through the normal task-update path (same
// statusId + position write board.js uses) -- progress and multi-roadmap
// effects fall out automatically since status lives solely on Task, not
// per-placement. The SyncProposal itself becoming ACCEPTED + decidedAt is
// the provenance stamp.
router.post('/proposals/:id/accept', async (req, res, next) => {
  try {
    const proposal = await prisma.syncProposal.findFirst({
      where: { id: req.params.id, task: { project: { ownerId: req.auth.sub } } },
      include: { task: true, proposedStatus: { select: { name: true } } }
    });
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    if (proposal.status !== 'PENDING') return res.status(400).json({ message: `Proposal is already ${proposal.status}` });

    const maxPosition = (await prisma.task.aggregate({ where: { statusId: proposal.proposedStatusId }, _max: { position: true } }))._max.position;
    const oldStatus = proposal.task.statusId
      ? await prisma.status.findUnique({ where: { id: proposal.task.statusId }, select: { name: true } })
      : null;

    const [updatedTask] = await prisma.$transaction(async (tx) => {
      const result = await Promise.all([
        tx.task.update({
          where: { id: proposal.taskId },
          data: { statusId: proposal.proposedStatusId, position: appendPosition(maxPosition) }
        }),
        tx.syncProposal.update({ where: { id: proposal.id }, data: { status: 'ACCEPTED', decidedAt: new Date() } })
      ]);
      await logActivity(tx, {
        taskId: proposal.taskId,
        eventType: 'moved_by_sync_proposal',
        oldValue: oldStatus?.name ?? null,
        newValue: proposal.proposedStatus.name,
        reason: proposal.reason,
        changedById: req.auth.sub
      });
      return result;
    });

    res.json({ task: updatedTask, proposalId: proposal.id, status: 'ACCEPTED' });
  } catch (error) {
    next(error);
  }
});

// Record retained, not deleted, so agents can avoid re-proposing.
router.post('/proposals/:id/dismiss', async (req, res, next) => {
  try {
    const proposal = await prisma.syncProposal.findFirst({
      where: { id: req.params.id, task: { project: { ownerId: req.auth.sub } } }
    });
    if (!proposal) return res.status(404).json({ message: 'Proposal not found' });
    if (proposal.status !== 'PENDING') return res.status(400).json({ message: `Proposal is already ${proposal.status}` });
    const updated = await prisma.syncProposal.update({ where: { id: proposal.id }, data: { status: 'DISMISSED', decidedAt: new Date() } });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Lightweight check for agents: previously-dismissed proposals for a task,
// so they can skip re-proposing the same status move.
router.get('/proposals/dismissed', async (req, res, next) => {
  try {
    const taskId = req.query.taskId;
    if (!taskId) return res.status(400).json({ message: 'taskId is required' });
    const task = await requireTask(taskId, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const dismissed = await prisma.syncProposal.findMany({
      where: { taskId: task.id, status: 'DISMISSED' },
      select: { id: true, proposedStatusId: true, reason: true, source: true, decidedAt: true },
      orderBy: { decidedAt: 'desc' }
    });
    res.json(dismissed);
  } catch (error) {
    next(error);
  }
});

export default router;
