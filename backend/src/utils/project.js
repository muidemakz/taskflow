export const projectInclude = {
  owner: { select: { id: true, name: true, email: true } },
  groups: {
    where: { deletedAt: null },
    include: { tasks: { where: { deletedAt: null } } },
    orderBy: { createdAt: 'asc' }
  },
  tasks: { where: { groupId: null, deletedAt: null }, orderBy: { createdAt: 'asc' } }
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
  return {
    ...project,
    order: orderArray(project),
    groups: project.groups.map((group) => ({
      ...group,
      tasks: group.tasks || []
    })),
    tasks: project.tasks || []
  };
}

export function taskCounts(project) {
  const root = project.tasks || [];
  const grouped = (project.groups || []).flatMap((group) => group.tasks || []);
  const tasks = [...root, ...grouped];
  const done = tasks.filter((task) => task.status === 'DONE').length;
  return { total: tasks.length, done, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

export function defaultOrder(project) {
  const taskKeys = (project.tasks || []).map((task) => `task:${task.id}`);
  const groupKeys = (project.groups || []).map((group) => `group:${group.id}`);
  return [...taskKeys, ...groupKeys];
}
