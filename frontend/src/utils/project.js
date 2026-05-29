export function formatDate(date) {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function stats(project) {
  if (!project) return { total: 0, done: 0, pct: 0 };
  if (project.stats) return { total: project.stats.total, done: project.stats.done, pct: project.stats.pct };
  const tasks = [...(project.tasks || []), ...(project.groups || []).flatMap((group) => group.tasks || [])];
  const done = tasks.filter((task) => task.status === 'DONE').length;
  return { total: tasks.length, done, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

export function orderedEntries(project) {
  const tasks = new Map((project.tasks || []).map((task) => [`task:${task.id}`, { type: 'task', item: task }]));
  const groups = new Map((project.groups || []).map((group) => [`group:${group.id}`, { type: 'group', item: group }]));
  const ordered = [];
  for (const key of project.order || []) {
    const entry = tasks.get(key) || groups.get(key);
    if (entry) ordered.push({ ...entry, key });
  }
  for (const [key, entry] of [...tasks, ...groups]) {
    if (!ordered.some((item) => item.key === key)) ordered.push({ ...entry, key });
  }
  return ordered;
}

export function visibleEntries(project, filters) {
  const query = filters.query.trim().toLowerCase();
  const after = filters.completedAfter ? new Date(filters.completedAfter) : null;
  const match = (task) => {
    if (query && !`${task.title} ${task.comment || ''}`.toLowerCase().includes(query)) return false;
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (after && (!task.completedAt || new Date(task.completedAt) < after)) return false;
    return true;
  };
  const sortTasks = (items) => {
    const copy = [...items];
    const time = (task) => (task.completedAt ? new Date(task.completedAt).getTime() : 0);
    if (filters.sort === 'todo-first') copy.sort((a, b) => Number(a.status === 'DONE') - Number(b.status === 'DONE'));
    if (filters.sort === 'done-first') copy.sort((a, b) => Number(b.status === 'DONE') - Number(a.status === 'DONE'));
    if (filters.sort === 'completed-desc') copy.sort((a, b) => time(b) - time(a));
    if (filters.sort === 'completed-asc') copy.sort((a, b) => time(a) - time(b));
    return copy;
  };
  return orderedEntries(project)
    .map((entry) => {
      if (entry.type === 'task') return match(entry.item) ? entry : null;
      const tasks = sortTasks((entry.item.tasks || []).filter(match));
      return tasks.length || (!query && filters.status === 'all' && !after) ? { ...entry, tasks } : null;
    })
    .filter(Boolean);
}
