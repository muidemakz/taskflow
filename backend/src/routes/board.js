import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireProject, requireTask, requireGate, requireStatus } from '../lib/ownership.js';
import { appendPosition } from '../lib/position.js';
import { logActivityMany } from '../lib/activity.js';

const router = Router();

function serializeTask(task) {
  return {
    ...task,
    tags: (task.tags || []).map((tt) => tt.tag)
  };
}

// gateId omitted -> project-level rollup (every task across every gate,
// plus Unscheduled, each shown once in its one true status). gateId
// provided -> scoped to that one gate.
router.get('/projects/:id/board', async (req, res, next) => {
  try {
    const project = await requireProject(req.params.id, req.auth.sub);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const gateId = req.query.gateId || null;
    if (gateId) {
      const gate = await requireGate(gateId, req.auth.sub);
      if (!gate || gate.roadmap.projectId !== project.id) {
        return res.status(400).json({ message: 'gateId does not belong to this project' });
      }
    }

    const [statuses, tasks] = await Promise.all([
      prisma.status.findMany({ where: { projectId: project.id }, orderBy: { order: 'asc' } }),
      prisma.task.findMany({
        where: { projectId: project.id, deletedAt: null, ...(gateId ? { gateId } : {}) },
        orderBy: { position: 'asc' },
        include: { tags: { include: { tag: true } } }
      })
    ]);

    const columns = statuses.map((status) => ({
      status,
      tasks: tasks.filter((t) => t.statusId === status.id).map(serializeTask)
    }));
    // "Unassigned" means no gate (Unscheduled), not no status -- every
    // task always has a real statusId post-migration.
    const unassignedCount = tasks.filter((t) => !t.gateId).length;

    res.json({ columns, unassignedCount });
  } catch (error) {
    next(error);
  }
});

// Extended task update: statusId (with position recalculation), gateId
// (including to/from null for Unscheduled), priority, dueDate,
// blocked/blockedNote, tag attach/detach -- one endpoint, matching how the
// spec frames this as a single "extended" update rather than several.
router.patch('/tasks/:taskId/board', async (req, res, next) => {
  try {
    const task = await requireTask(req.params.taskId, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const data = {};
    const activityEntries = [];
    const changedById = req.auth.sub;

    if (req.body.priority) {
      const priority = String(req.body.priority).toUpperCase();
      if (!['NONE', 'LOW', 'MID', 'HIGH'].includes(priority)) {
        return res.status(400).json({ message: 'Invalid priority' });
      }
      if (priority !== task.priority) {
        data.priority = priority;
        activityEntries.push({ taskId: task.id, eventType: 'priority_changed', oldValue: task.priority, newValue: priority, changedById });
      }
    }
    if ('dueDate' in req.body) {
      const newDueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
      const oldIso = task.dueDate ? task.dueDate.toISOString() : null;
      const newIso = newDueDate ? newDueDate.toISOString() : null;
      if (oldIso !== newIso) {
        data.dueDate = newDueDate;
        activityEntries.push({
          taskId: task.id,
          eventType: 'due_date_set',
          oldValue: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
          newValue: newDueDate ? newDueDate.toISOString().slice(0, 10) : null,
          changedById
        });
      }
    }
    if (typeof req.body.blocked === 'boolean' && req.body.blocked !== task.blocked) {
      data.blocked = req.body.blocked;
      activityEntries.push({
        taskId: task.id,
        eventType: 'blocked',
        oldValue: task.blocked ? 'blocked' : 'not blocked',
        newValue: req.body.blocked ? 'blocked' : 'not blocked',
        reason: req.body.blocked ? req.body.blockedNote || null : null,
        changedById
      });
    }
    if ('blockedNote' in req.body) data.blockedNote = req.body.blockedNote || null;
    if (typeof req.body.focus === 'boolean' && req.body.focus !== task.focus) {
      data.focus = req.body.focus;
      activityEntries.push({
        taskId: task.id,
        eventType: 'focus_toggled',
        oldValue: task.focus ? 'on' : 'off',
        newValue: req.body.focus ? 'on' : 'off',
        reason: req.body.focus && req.body.focusTargetDate ? `target: ${req.body.focusTargetDate}` : null,
        changedById
      });
    }
    if ('focusTargetDate' in req.body) data.focusTargetDate = req.body.focusTargetDate ? new Date(req.body.focusTargetDate) : null;
    if ('title' in req.body && typeof req.body.title === 'string' && req.body.title.trim()) data.title = req.body.title.trim();
    if ('comment' in req.body) {
      const newComment = req.body.comment || null;
      if (newComment !== (task.comment || null)) {
        data.comment = newComment;
        activityEntries.push({ taskId: task.id, eventType: 'comment_added', oldValue: null, newValue: newComment, changedById });
      }
    }

    if ('gateId' in req.body) {
      let newGateName = null;
      if (req.body.gateId) {
        const gate = await requireGate(req.body.gateId, req.auth.sub);
        if (!gate || gate.roadmap.projectId !== task.projectId) {
          return res.status(400).json({ message: 'gateId does not belong to this project' });
        }
        data.gateId = gate.id;
        newGateName = gate.name;
      } else {
        data.gateId = null;
      }

      if (data.gateId !== task.gateId) {
        let oldGateName = null;
        if (task.gateId) {
          const oldGate = await prisma.gate.findUnique({ where: { id: task.gateId } });
          oldGateName = oldGate?.name ?? null;
        }
        const eventType = !task.gateId && data.gateId ? 'gate_assigned' : task.gateId && !data.gateId ? 'gate_removed' : 'gate_changed';
        activityEntries.push({ taskId: task.id, eventType, oldValue: oldGateName, newValue: newGateName, changedById });
      }
    }

    if (req.body.statusId) {
      const status = await requireStatus(req.body.statusId, req.auth.sub);
      if (!status || status.projectId !== task.projectId) {
        return res.status(400).json({ message: 'statusId does not belong to this project' });
      }
      if (status.id !== task.statusId) {
        data.statusId = status.id;
        let oldStatusName = null;
        if (task.statusId) {
          const oldStatus = await prisma.status.findUnique({ where: { id: task.statusId } });
          oldStatusName = oldStatus?.name ?? null;
        }
        activityEntries.push({ taskId: task.id, eventType: 'status_changed', oldValue: oldStatusName, newValue: status.name, changedById });
      }
      if (typeof req.body.position === 'number') {
        data.position = req.body.position;
      } else if (data.statusId) {
        const max = (await prisma.task.aggregate({ where: { statusId: status.id }, _max: { position: true } }))._max.position;
        data.position = appendPosition(max);
      }
    } else if (typeof req.body.position === 'number') {
      data.position = req.body.position;
    }

    const addTagIds = Array.isArray(req.body.addTagIds) ? req.body.addTagIds : [];
    const removeTagIds = Array.isArray(req.body.removeTagIds) ? req.body.removeTagIds : [];

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) await tx.task.update({ where: { id: task.id }, data });
      if (addTagIds.length) {
        const tags = await tx.tag.findMany({ where: { id: { in: addTagIds }, projectId: task.projectId, deletedAt: null } });
        if (tags.length) {
          await tx.taskTag.createMany({ data: tags.map((t) => ({ taskId: task.id, tagId: t.id })), skipDuplicates: true });
          for (const t of tags) {
            activityEntries.push({ taskId: task.id, eventType: 'tag_added', oldValue: null, newValue: t.name, changedById });
          }
        }
      }
      if (removeTagIds.length) {
        const removedTags = await tx.tag.findMany({ where: { id: { in: removeTagIds } } });
        await tx.taskTag.deleteMany({ where: { taskId: task.id, tagId: { in: removeTagIds } } });
        for (const t of removedTags) {
          activityEntries.push({ taskId: task.id, eventType: 'tag_removed', oldValue: t.name, newValue: null, changedById });
        }
      }
      if (activityEntries.length) await logActivityMany(tx, activityEntries);
      return tx.task.findUnique({ where: { id: task.id }, include: { tags: { include: { tag: true } } } });
    });

    res.json(serializeTask(updated));
  } catch (error) {
    next(error);
  }
});

// Read-only timeline for the task detail modal's Activity section --
// there is deliberately no update/delete endpoint, rows are only ever
// produced as a side effect of the mutations above.
router.get('/tasks/:taskId/activity', async (req, res, next) => {
  try {
    const task = await requireTask(req.params.taskId, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const activity = await prisma.taskActivity.findMany({
      where: { taskId: task.id },
      include: { changedBy: { select: { id: true, name: true } } },
      orderBy: { changedAt: 'desc' }
    });
    res.json(activity);
  } catch (error) {
    next(error);
  }
});

// Additional gate placement within the same roadmap. Status is never
// per-placement -- it's always the task's single shared statusId, so there
// is nothing to choose here beyond which gate.
router.post('/tasks/:taskId/gate-placements', async (req, res, next) => {
  try {
    const task = await requireTask(req.params.taskId, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const gate = await requireGate(req.body.gateId, req.auth.sub);
    if (!gate || gate.roadmap.projectId !== task.projectId) {
      return res.status(400).json({ message: 'gateId does not belong to this project' });
    }
    const placement = await prisma.taskGatePlacement.upsert({
      where: { taskId_gateId: { taskId: task.id, gateId: gate.id } },
      update: {},
      create: { taskId: task.id, gateId: gate.id }
    });
    res.status(201).json(placement);
  } catch (error) {
    next(error);
  }
});

// Every roadmap/gate a task counts toward: its primary placement
// (Task.gateId), additional gates in the same roadmap (TaskGatePlacement),
// and membership in other roadmaps entirely (TaskRoadmap).
router.get('/tasks/:taskId/roadmaps', async (req, res, next) => {
  try {
    const task = await requireTask(req.params.taskId, req.auth.sub);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const [primaryGate, gatePlacements, taskRoadmaps] = await Promise.all([
      task.gateId ? prisma.gate.findUnique({ where: { id: task.gateId } }) : null,
      prisma.taskGatePlacement.findMany({ where: { taskId: task.id }, include: { gate: true } }),
      prisma.taskRoadmap.findMany({ where: { taskId: task.id }, include: { roadmap: true, gate: true } })
    ]);

    const entries = [];
    if (primaryGate) {
      entries.push({ roadmapId: primaryGate.roadmapId, gateId: primaryGate.id, gateName: primaryGate.name, relation: 'primary' });
    }
    for (const p of gatePlacements) {
      entries.push({ roadmapId: p.gate.roadmapId, gateId: p.gate.id, gateName: p.gate.name, relation: 'gatePlacement' });
    }
    for (const tr of taskRoadmaps) {
      entries.push({ roadmapId: tr.roadmapId, gateId: tr.gateId, gateName: tr.gate?.name ?? null, relation: 'taskRoadmap' });
    }

    res.json({ taskId: task.id, statusId: task.statusId, entries });
  } catch (error) {
    next(error);
  }
});

export default router;
