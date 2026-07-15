// Mirrors backend/src/lib/position.js -- kept as a small duplicated pure
// function rather than shared across the frontend/backend boundary.
const POSITION_STEP = 1000;

export function appendPosition(maxPosition) {
  return (maxPosition ?? 0) + POSITION_STEP;
}

export function insertBetween(before, after) {
  if (before == null && after == null) return POSITION_STEP;
  if (before == null) return after / 2;
  if (after == null) return before + POSITION_STEP;
  return (before + after) / 2;
}

export const priorityMeta = {
  NONE: { label: 'None', className: 'bg-slate-50 text-muted' },
  LOW: { label: 'Low', className: 'bg-emerald-50 text-emerald-700' },
  MID: { label: 'Mid', className: 'bg-amber-50 text-amber-700' },
  HIGH: { label: 'High', className: 'bg-red-50 text-red-700' }
};

// Deterministic color per tag so the same tag always renders the same
// color without storing one -- hashes the tag id into a small palette
// that stays within the existing design system's tonal range (matches
// the priority chips' bg-50/text-700 pairing convention).
const TAG_PALETTE = [
  'bg-blue-50 text-blue-700',
  'bg-emerald-50 text-emerald-700',
  'bg-amber-50 text-amber-700',
  'bg-red-50 text-red-700',
  'bg-purple-50 text-purple-700',
  'bg-pink-50 text-pink-700',
  'bg-cyan-50 text-cyan-700',
  'bg-teal-50 text-teal-700'
];

export function tagColorClass(tagId) {
  let hash = 0;
  for (let i = 0; i < tagId.length; i += 1) hash = (hash * 31 + tagId.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

// Small, stable per-status color for the list view's status dot -- based
// on the status's position among a project's (typically 5) statuses, not
// its id, so it stays visually consistent as columns are scanned left to
// right / top to bottom.
const STATUS_DOT_COLORS = ['bg-slate-400', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-emerald-500', 'bg-pink-500'];

export function statusDotColor(status) {
  return STATUS_DOT_COLORS[(status.order ?? 0) % STATUS_DOT_COLORS.length];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isOverdue(task) {
  if (!task.dueDate) return false;
  return new Date(task.dueDate) < startOfToday();
}

export function isDueThisWeek(task) {
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  const start = startOfToday();
  return due >= start && due < new Date(start.getTime() + 7 * DAY_MS);
}

export function formatDueDate(dueDate) {
  if (!dueDate) return null;
  return new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const PRIORITY_ORDER = { HIGH: 0, MID: 1, LOW: 2, NONE: 3 };

export function sortTasks(tasks, sortKey, workflowContext) {
  const copy = [...tasks];
  switch (sortKey) {
    case 'newest':
      return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'oldest':
      return copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case 'due':
      return copy.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    case 'priority':
      return copy.sort((a, b) => PRIORITY_ORDER[a.priority ?? 'NONE'] - PRIORITY_ORDER[b.priority ?? 'NONE']);
    case 'workflow':
      return sortByWorkflowOrder(copy, workflowContext);
    default:
      return copy.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }
}

// Unscheduled first (if the project has a roadmap), then by gate order,
// then by status order.
function sortByWorkflowOrder(tasks, { gateOrderById = {}, statusOrderById = {}, hasRoadmap = false } = {}) {
  const gateRank = (task) => {
    if (!hasRoadmap) return 0;
    if (!task.gateId) return -1; // Unscheduled first
    return gateOrderById[task.gateId] ?? Number.MAX_SAFE_INTEGER;
  };
  return tasks.sort((a, b) => {
    const gateDiff = gateRank(a) - gateRank(b);
    if (gateDiff !== 0) return gateDiff;
    const statusDiff = (statusOrderById[a.statusId] ?? 0) - (statusOrderById[b.statusId] ?? 0);
    if (statusDiff !== 0) return statusDiff;
    return (a.position ?? 0) - (b.position ?? 0);
  });
}

export const EMPTY_FILTERS = { tagIds: [], priority: '', blockedOnly: false, focusOnly: false, dueFilter: '' };

export function hasActiveFilters(filters) {
  return Boolean(filters.tagIds.length || filters.priority || filters.blockedOnly || filters.focusOnly || filters.dueFilter);
}

// All conditions AND together, applied client-side against the
// already-loaded board -- no new endpoint.
export function filterTasks(tasks, filters) {
  return tasks.filter((task) => {
    if (filters.tagIds.length && !task.tags?.some((t) => filters.tagIds.includes(t.id))) return false;
    if (filters.priority && (task.priority || 'NONE') !== filters.priority) return false;
    if (filters.blockedOnly && !task.blocked) return false;
    if (filters.focusOnly && !task.focus) return false;
    if (filters.dueFilter === 'overdue' && !isOverdue(task)) return false;
    if (filters.dueFilter === 'thisWeek' && !isDueThisWeek(task)) return false;
    if (filters.dueFilter === 'hasDate' && !task.dueDate) return false;
    if (filters.dueFilter === 'noDate' && task.dueDate) return false;
    return true;
  });
}

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest → Oldest' },
  { value: 'oldest', label: 'Oldest → Newest' },
  { value: 'due', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'workflow', label: 'Progress order' }
];
