export const projectInclude = {
  owner: { select: { id: true, name: true, email: true } },
  groups: {
    where: { deletedAt: null },
    include: { tasks: { where: { deletedAt: null } } },
    orderBy: { createdAt: 'asc' }
  },
  tasks: { where: { groupId: null, deletedAt: null }, orderBy: { createdAt: 'asc' } },
  // Only what taskCounts() needs to derive "done" from the real kanban
  // status system -- see taskCounts() below.
  statuses: { select: { id: true, countsAsDone: true } }
};

export function orderArray(project) {
  if (Array.isArray(project.order)) return project.order;
  try {
    const parsed = JSON.parse(project.order || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeOrder(order) {
  return Array.isArray(order) ? order : [];
}

// customId (TID) is deliberately excluded here: it is generated once at
// creation (see utils/customId.js) and frozen forever after -- this route
// must never let a client overwrite it, on top of everything else it's
// stable against (gate moves, rollover, reorder).
export function normalizeTaskInput(data = {}) {
  const patch = {};
  if (typeof data.title === 'string') patch.title = data.title.trim();
  if (data.status) {
    patch.status = data.status === 'DONE' || data.status === 'done' ? 'DONE' : 'TODO';
    patch.completedAt = patch.status === 'DONE' ? new Date() : null;
  }
  if (data.priority) patch.priority = String(data.priority).toUpperCase();
  if (typeof data.comment === 'string') patch.comment = data.comment;
  return patch;
}

export function toClientProject(project) {
  // statuses is fetched only for taskCounts()'s internal use below -- the
  // client already gets the full Status list from the board API, so it's
  // dropped here rather than duplicated under a second, unrelated shape.
  const { statuses, ...rest } = project;
  return {
    ...rest,
    order: orderArray(project),
    groups: project.groups.map((group) => ({
      ...group,
      tasks: group.tasks || []
    })),
    tasks: project.tasks || []
  };
}

// "Done" is derived from statusId -> Status.countsAsDone (the real kanban
// system), not the legacy status column -- the legacy column is written
// only by the orphaned /legacy view and drifts from statusId the moment a
// task is moved on the real board, so it silently understates completion.
// project.statuses must be included (see projectInclude above) for this.
export function taskCounts(project) {
  const root = project.tasks || [];
  const grouped = (project.groups || []).flatMap((group) => group.tasks || []);
  const tasks = [...root, ...grouped];
  const doneStatusIds = new Set((project.statuses || []).filter((s) => s.countsAsDone).map((s) => s.id));
  const done = tasks.filter((task) => task.statusId && doneStatusIds.has(task.statusId)).length;
  return { total: tasks.length, done, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

export function defaultOrder(project) {
  const taskKeys = (project.tasks || []).map((task) => `task:${task.id}`);
  const groupKeys = (project.groups || []).map((group) => `group:${group.id}`);
  return [...taskKeys, ...groupKeys];
}
