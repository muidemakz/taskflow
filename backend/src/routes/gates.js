import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma.js';
import { requireProject, requireGate } from '../lib/ownership.js';
import { planGateClose } from '../lib/rollover.js';
import { logActivityMany } from '../lib/activity.js';
import { validateGateImportRows } from '../lib/gateImport.js';

const router = Router();

function shareUrlFor(token) {
  if (!token) return null;
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontend.replace(/\/$/, '')}/share/${token}`;
}

// A project's Roadmap is provisioned lazily on first gate creation, not by
// a separate "enable roadmap" step -- there was no other natural entry
// point for it, and a roadmap with zero gates isn't meaningfully different
// from no roadmap at all.
async function ensureRoadmap(projectId) {
  const existing = await prisma.roadmap.findUnique({ where: { projectId } });
  if (existing) return existing;
  return prisma.$transaction(async (tx) => {
    const roadmap = await tx.roadmap.create({ data: { projectId } });
    await tx.project.update({ where: { id: projectId }, data: { hasRoadmap: true } });
    return roadmap;
  });
}

router.post('/projects/:id/gates', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ message: 'Gate name is required' });

    const roadmap = await ensureRoadmap(project.id);
    const maxOrder = (await prisma.gate.aggregate({ where: { roadmapId: roadmap.id }, _max: { order: true } }))._max.order ?? -1;
    const gate = await prisma.gate.create({ data: { roadmapId: roadmap.id, name, order: maxOrder + 1 } });
    res.status(201).json(gate);
  } catch (error) {
    next(error);
  }
});

router.patch('/gates/:gateId', async (req, res, next) => {
  try {
    const gate = await requireGate(req.params.gateId, req.auth.sub);
    if (!gate) return res.status(404).json({ message: 'Gate not found' });
    const data = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) data.name = req.body.name.trim();
    if (Number.isInteger(req.body.order)) data.order = req.body.order;
    if ('description' in req.body) data.description = req.body.description?.trim() || null;
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Nothing to update' });
    const updated = await prisma.gate.update({ where: { id: gate.id }, data });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Token is lazily generated the first time sharing is turned on and never
// rotated afterward -- same behavior as Project.shareToken's PATCH .../share.
router.patch('/gates/:gateId/share', async (req, res, next) => {
  try {
    const gate = await requireGate(req.params.gateId, req.auth.sub);
    if (!gate) return res.status(404).json({ message: 'Gate not found' });
    const shareEnabled = Boolean(req.body.shareEnabled);
    const data = { shareEnabled };
    if (shareEnabled && !gate.shareToken) data.shareToken = randomUUID();
    const updated = await prisma.gate.update({ where: { id: gate.id }, data });
    res.json({ ...updated, shareUrl: shareUrlFor(updated.shareToken) });
  } catch (error) {
    next(error);
  }
});

// CSV rows arrive already parsed to JSON from the client (gate_name, order,
// description) rather than as a multipart file upload -- there is no
// existing file-upload path (or CSV-parsing dependency) anywhere in this
// backend, and parsing client-side keeps the wire format consistent with
// every other endpoint in this API. The `order` column is validated for
// internal consistency (no duplicates within the batch) but the values
// actually persisted are re-sequenced after the project's existing gates,
// preserving the CSV's relative order -- using the raw CSV numbers directly
// could collide with order values already in use and corrupt the existing
// reorder-by-swap logic in GateSettingsList.
router.post('/projects/:id/gates/bulk-import', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ message: 'No rows to import' });

    const { errors, validRows } = validateGateImportRows(rows);
    if (errors.length) return res.status(400).json({ created: [], errors });

    const roadmap = await ensureRoadmap(project.id);
    const maxOrder = (await prisma.gate.aggregate({ where: { roadmapId: roadmap.id }, _max: { order: true } }))._max.order ?? -1;

    const created = await prisma.$transaction(
      validRows.map((row, i) =>
        prisma.gate.create({ data: { roadmapId: roadmap.id, name: row.name, description: row.description, order: maxOrder + 1 + i } })
      )
    );

    res.status(201).json({
      created: created.map((g) => g.id),
      errors: [],
      summary: `Created ${created.length} gate${created.length === 1 ? '' : 's'}`
    });
  } catch (error) {
    next(error);
  }
});

// Three-path deletion, same pattern as Doc category deletion:
//   reassign: move every task (and secondary placements) to targetGateId
//   create-and-move: create a new gate in the same roadmap, move everything there
//   unschedule: null the gate out (tasks become Unscheduled)
router.delete('/gates/:gateId', async (req, res, next) => {
  try {
    const gate = await requireGate(req.params.gateId, req.auth.sub);
    if (!gate) return res.status(404).json({ message: 'Gate not found' });
    const mode = req.body.mode;

    let targetGateId = null;
    let createdGate = null;

    if (mode === 'reassign') {
      targetGateId = req.body.targetGateId;
      if (!targetGateId) return res.status(400).json({ message: 'targetGateId is required for reassign' });
      const target = await requireGate(targetGateId, req.auth.sub);
      if (!target || target.roadmapId !== gate.roadmapId) {
        return res.status(400).json({ message: 'targetGateId must be a gate in the same roadmap' });
      }
    } else if (mode === 'create-and-move') {
      const newGateName = req.body.newGateName?.trim();
      if (!newGateName) return res.status(400).json({ message: 'newGateName is required for create-and-move' });
      const maxOrder = (await prisma.gate.aggregate({ where: { roadmapId: gate.roadmapId }, _max: { order: true } }))._max.order ?? -1;
      createdGate = await prisma.gate.create({ data: { roadmapId: gate.roadmapId, name: newGateName, order: maxOrder + 1 } });
      targetGateId = createdGate.id;
    } else if (mode === 'unschedule') {
      targetGateId = null;
    } else {
      return res.status(400).json({ message: 'mode must be one of: reassign, create-and-move, unschedule' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const movedTasks = await tx.task.updateMany({ where: { gateId: gate.id }, data: { gateId: targetGateId } });
      const movedPlacements = await tx.taskGatePlacement.updateMany({ where: { gateId: gate.id }, data: { gateId: targetGateId } }).catch(() => ({ count: 0 }));
      // TaskGatePlacement's composite PK means updateMany can violate the
      // unique (taskId, gateId) constraint if a task already has a
      // placement in targetGateId -- fall back to a per-row upsert-safe
      // pass for whatever the bulk update couldn't cover.
      const remaining = await tx.taskGatePlacement.findMany({ where: { gateId: gate.id } });
      for (const placement of remaining) {
        const exists = targetGateId
          ? await tx.taskGatePlacement.findUnique({ where: { taskId_gateId: { taskId: placement.taskId, gateId: targetGateId } } })
          : null;
        if (targetGateId && !exists) {
          await tx.taskGatePlacement.update({ where: { taskId_gateId: { taskId: placement.taskId, gateId: gate.id } }, data: { gateId: targetGateId } });
        } else {
          await tx.taskGatePlacement.delete({ where: { taskId_gateId: { taskId: placement.taskId, gateId: gate.id } } });
        }
      }
      await tx.taskRoadmap.updateMany({ where: { gateId: gate.id }, data: { gateId: targetGateId } });
      await tx.gate.update({ where: { id: gate.id }, data: { deletedAt: new Date() } });
      return { movedTaskCount: movedTasks.count, movedPlacementCount: movedPlacements.count };
    });

    res.json({ deletedGateId: gate.id, mode, targetGateId, createdGate, ...result });
  } catch (error) {
    next(error);
  }
});

// Rollover. rolloverMode === 'AUTOMATIC': moves incomplete tasks to the
// next gate immediately. 'ASK_FIRST': first call (no confirm) returns the
// incomplete-task list for the frontend to show; a second call with
// { confirm: true } actually executes the move. `reason` is accepted (and
// should be resent) on both calls -- only the confirmed/terminal call
// actually persists it, since NEEDS_CONFIRMATION is a pure preview with no
// database writes.
router.post('/gates/:gateId/close', async (req, res, next) => {
  try {
    const gate = await requireGate(req.params.gateId, req.auth.sub);
    if (!gate) return res.status(404).json({ message: 'Gate not found' });
    const project = gate.roadmap.project;
    const reason = req.body.reason?.trim() || null;
    const changedById = req.auth.sub;

    const [gates, tasksInGate, doneStatus] = await Promise.all([
      prisma.gate.findMany({ where: { roadmapId: gate.roadmapId, deletedAt: null } }),
      prisma.task.findMany({ where: { gateId: gate.id, deletedAt: null }, orderBy: { position: 'asc' } }),
      prisma.status.findFirst({ where: { projectId: project.id, countsAsDone: true } })
    ]);
    if (!doneStatus) return res.status(400).json({ message: 'Project has no counts-as-done status configured' });

    const plan = planGateClose({
      rolloverMode: project.rolloverMode,
      gates,
      currentGateId: gate.id,
      tasksInGate,
      doneStatusId: doneStatus.id,
      confirmed: Boolean(req.body.confirm)
    });

    if (plan.action === 'NEEDS_CONFIRMATION') {
      return res.json({
        action: plan.action,
        nextGateId: plan.nextGate.id,
        incompleteTasks: plan.incomplete.map((t) => ({ id: t.id, title: t.title }))
      });
    }

    await prisma.$transaction(async (tx) => {
      if (plan.action === 'ROLL_TO_NEXT_GATE') {
        const maxPosition = (await tx.task.aggregate({ where: { gateId: plan.nextGate.id }, _max: { position: true } }))._max.position ?? 0;
        await Promise.all(
          plan.incomplete.map((task, i) =>
            tx.task.update({
              where: { id: task.id },
              data: {
                gateId: plan.nextGate.id,
                movedFromGateId: gate.id,
                movedFromGateAt: new Date(),
                position: maxPosition + (i + 1) * 1000
              }
            })
          )
        );
        await logActivityMany(tx, plan.incomplete.map((task) => ({
          taskId: task.id,
          eventType: 'gate_changed',
          oldValue: gate.name,
          newValue: plan.nextGate.name,
          reason: 'Rolled over on gate close',
          changedById
        })));
      }

      await tx.gate.update({ where: { id: gate.id }, data: { status: 'CLOSED', closedAt: new Date(), closedReason: reason } });

      if (tasksInGate.length) {
        await logActivityMany(tx, tasksInGate.map((task) => ({
          taskId: task.id,
          eventType: 'closed_gate_reason',
          oldValue: null,
          newValue: null,
          reason,
          changedById
        })));
      }
    });

    res.json({
      action: plan.action,
      nextGateId: plan.nextGate?.id ?? null,
      movedCount: plan.action === 'ROLL_TO_NEXT_GATE' ? plan.incomplete.length : 0,
      incompleteRemaining: plan.action === 'NO_NEXT_GATE' ? plan.incomplete.length : 0
    });
  } catch (error) {
    next(error);
  }
});

router.post('/gates/:gateId/reopen', async (req, res, next) => {
  try {
    const gate = await requireGate(req.params.gateId, req.auth.sub);
    if (!gate) return res.status(404).json({ message: 'Gate not found' });
    if (gate.status !== 'CLOSED') return res.status(400).json({ message: 'Gate is not closed' });

    const reason = req.body.reason?.trim() || null;
    const changedById = req.auth.sub;
    const tasksInGate = await prisma.task.findMany({ where: { gateId: gate.id, deletedAt: null }, select: { id: true } });

    const updated = await prisma.$transaction(async (tx) => {
      const reopened = await tx.gate.update({ where: { id: gate.id }, data: { status: 'OPEN', closedAt: null, closedReason: null } });
      if (tasksInGate.length) {
        await logActivityMany(tx, tasksInGate.map((task) => ({
          taskId: task.id,
          eventType: 'reopened_gate_reason',
          oldValue: null,
          newValue: null,
          reason,
          changedById
        })));
      }
      return reopened;
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
