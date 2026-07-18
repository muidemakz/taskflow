import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import InlineTaskModal from '../components/board/InlineTaskModal';
import SharedFilterBar from '../components/SharedFilterBar';
import TagMultiSelect from '../components/TagMultiSelect';
import { meApi, projectsApi, roadmapApi } from '../api/endpoints';
import { formatDueDate, isOverdue, priorityMeta, tagColorClass } from '../utils/board';

export const EMPTY_MY_TASK_FILTERS = {
  projectId: '',
  tagIds: [],
  priority: '',
  statusId: '',
  gateId: '',
  blockedOnly: false,
  dueFrom: '',
  dueTo: '',
  search: ''
};

export function countActiveMyTaskFilters(f) {
  let n = 0;
  if (f.projectId) n += 1;
  if (f.tagIds.length) n += 1;
  if (f.priority) n += 1;
  if (f.statusId) n += 1;
  if (f.gateId) n += 1;
  if (f.blockedOnly) n += 1;
  if (f.dueFrom || f.dueTo) n += 1;
  if (f.search.trim()) n += 1;
  return n;
}

const LAST_PROJECT_KEY = 'taskflow_last_project';

const BUCKET_TABS = [
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'focus', label: 'Focus' },
  { key: 'allPending', label: 'All pending' }
];

// Every dimension ANDs together, applied client-side over the already-loaded
// buckets -- no new endpoint. gateId '__none__' is the sentinel for
// Unscheduled (tasks with no gate).
function applyMyTaskFilters(tasks, f) {
  const q = f.search.trim().toLowerCase();
  const from = f.dueFrom ? new Date(f.dueFrom) : null;
  const to = f.dueTo ? new Date(`${f.dueTo}T23:59:59`) : null;
  return tasks.filter((t) => {
    if (f.projectId && t.projectId !== f.projectId) return false;
    if (f.tagIds.length && !t.tags?.some((tag) => f.tagIds.includes(tag.id))) return false;
    if (f.priority && (t.priority || 'NONE') !== f.priority) return false;
    if (f.statusId && t.statusId !== f.statusId) return false;
    if (f.gateId === '__none__') {
      if (t.gateId) return false;
    } else if (f.gateId && t.gateId !== f.gateId) return false;
    if (f.blockedOnly && !t.blocked) return false;
    if (from && (!t.dueDate || new Date(t.dueDate) < from)) return false;
    if (to && (!t.dueDate || new Date(t.dueDate) > to)) return false;
    if (q && !`${t.title} ${t.customId || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export default function MyTasks() {
  const [buckets, setBuckets] = useState(null);
  const [openTask, setOpenTask] = useState(null);
  const [activeTab, setActiveTab] = useState('today');
  const [filters, setFilters] = useState(EMPTY_MY_TASK_FILTERS);
  const [projects, setProjects] = useState([]);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickProjectId, setQuickProjectId] = useState('');
  const [quickGateId, setQuickGateId] = useState('');
  const [quickGates, setQuickGates] = useState([]);
  const [adding, setAdding] = useState(false);

  function loadTasks() {
    meApi.tasks().then(({ data }) => setBuckets(data.buckets));
  }

  // Targeted update instead of a reload: patch the task in place, in every
  // bucket it currently appears in (a task can be in several -- e.g. due
  // today AND focused). A status that now counts as done takes it out of
  // every bucket immediately, matching "every not-done task" -- otherwise
  // this page has no visible status field to update, only the fields
  // TaskRow renders (title, priority, due date, focus, tags, gate).
  function applyTaskUpdate(updated) {
    setBuckets((prev) => {
      if (!prev) return prev;
      const next = {};
      for (const key of Object.keys(prev)) {
        next[key] = updated.countsAsDone
          ? prev[key].filter((t) => t.id !== updated.id)
          : prev[key].map((t) => (t.id === updated.id
            ? { ...t, title: updated.title, priority: updated.priority, dueDate: updated.dueDate, blocked: updated.blocked, focus: updated.focus, tags: updated.tags, gate: updated.gate, gateId: updated.gateId, customId: updated.customId }
            : t));
      }
      return next;
    });
  }

  useEffect(() => {
    loadTasks();
    projectsApi.list().then(({ data }) => {
      setProjects(data);
      const lastUsed = localStorage.getItem(LAST_PROJECT_KEY);
      const fallback = data.some((p) => p.id === lastUsed) ? lastUsed : data[0]?.id || '';
      setQuickProjectId(fallback);
    });
  }, []);

  // Gate is optional and scoped to whichever project is currently picked --
  // reset to Unscheduled whenever the project changes rather than carrying
  // a gate id that may not belong to the new project.
  useEffect(() => {
    setQuickGateId('');
    if (!quickProjectId) return setQuickGates([]);
    roadmapApi.get(quickProjectId).then(({ data }) => setQuickGates(data.gates || []));
  }, [quickProjectId]);

  async function submitQuickAdd(e) {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title || !quickProjectId) return;
    setAdding(true);
    try {
      // gateId passed straight into create (not a follow-up move) so the
      // task's customId is generated against its real, final gate -- it
      // never changes after creation, so Unscheduled-then-moved would leave
      // a gated task stuck with an Unscheduled-style id forever.
      await projectsApi.createTask(quickProjectId, { title, gateId: quickGateId || undefined });
      localStorage.setItem(LAST_PROJECT_KEY, quickProjectId);
      setQuickTitle('');
      toast.success('Task added');
      loadTasks();
    } catch {
      toast.error('Could not add task');
    } finally {
      setAdding(false);
    }
  }

  // Filter dropdown options are derived from the full pending set (a superset
  // of every bucket) so they stay stable regardless of which bucket is active.
  const filterOptions = useMemo(() => {
    const all = buckets?.allPending || [];
    const projMap = new Map();
    const tagMap = new Map();
    const statusMap = new Map();
    const gateMap = new Map();
    let hasUnscheduled = false;
    for (const t of all) {
      if (t.project) projMap.set(t.project.id, t.project.title);
      for (const tag of t.tags || []) tagMap.set(tag.id, tag);
      if (t.taskStatus) statusMap.set(t.taskStatus.id, t.taskStatus.name);
      if (t.gate) gateMap.set(t.gate.id, t.gate.name);
      if (!t.gateId) hasUnscheduled = true;
    }
    return {
      projects: [...projMap].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title)),
      tags: [...tagMap.values()],
      statuses: [...statusMap].map(([id, name]) => ({ id, name })),
      gates: [...gateMap].map(([id, name]) => ({ id, name })),
      hasUnscheduled
    };
  }, [buckets]);

  if (!buckets) return <main className="p-8 text-center text-muted">Loading your tasks...</main>;

  const rawTasks = buckets[activeTab] || [];
  const tasks = applyMyTaskFilters(rawTasks, filters);
  const activeFilterCount = countActiveMyTaskFilters(filters);

  return (
    <main className="page-container py-6">
      <h1 className="text-xl font-bold">My Tasks</h1>
      <p className="mt-1 text-sm text-muted">Every not-done task across your projects.</p>

      <form onSubmit={submitQuickAdd} className="card mt-4 flex flex-col gap-2 p-3 sm:flex-row">
        <input
          className="field flex-1"
          placeholder="Quick-add a task..."
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
        />
        <select className="field sm:w-56" value={quickProjectId} onChange={(e) => setQuickProjectId(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}{p.metrics ? ` (${p.metrics.gateCount}g · ${p.metrics.taskCount}t)` : ''}
            </option>
          ))}
        </select>
        <select className="field sm:w-44" value={quickGateId} onChange={(e) => setQuickGateId(e.target.value)}>
          <option value="">Unscheduled</option>
          {quickGates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button className="btn-primary shrink-0" disabled={adding || !quickTitle.trim() || !quickProjectId}>
          <Plus size={16} /> Add
        </button>
      </form>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {BUCKET_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              activeTab === tab.key
                ? 'border-primary bg-primary text-white'
                : 'border-[#d8e0ea] bg-white text-muted dark:border-slate-700 dark:bg-slate-800'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label} <span className="ml-1 opacity-80">{buckets[tab.key]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <SharedFilterBar
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_MY_TASK_FILTERS)}
        placeholder="Search title or ID..."
        filterFields={[
          {
            key: 'projectId',
            render: (f, set) => (
              <select className="field" value={f.projectId} onChange={(e) => set({ projectId: e.target.value })}>
                <option value="">Any project</option>
                {filterOptions.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            )
          },
          {
            key: 'statusId',
            render: (f, set) => (
              <select className="field" value={f.statusId} onChange={(e) => set({ statusId: e.target.value })}>
                <option value="">Any status</option>
                {filterOptions.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )
          },
          {
            key: 'priority',
            render: (f, set) => (
              <select className="field" value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
                <option value="">Any priority</option>
                <option value="HIGH">High</option>
                <option value="MID">Mid</option>
                <option value="LOW">Low</option>
                <option value="NONE">None</option>
              </select>
            )
          },
          {
            key: 'gateId',
            render: (f, set) => (
              <select className="field" value={f.gateId} onChange={(e) => set({ gateId: e.target.value })}>
                <option value="">Any gate</option>
                {filterOptions.hasUnscheduled && <option value="__none__">Unscheduled</option>}
                {filterOptions.gates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )
          },
          {
            key: 'dueDate',
            render: (f, set) => (
              <div className="flex items-center gap-2 rounded-md border border-border bg-white px-2 dark:bg-slate-800 dark:border-slate-700">
                <span className="text-sm text-muted">Due</span>
                <input type="date" className="field border-0 px-1" value={f.dueFrom} onChange={(e) => set({ dueFrom: e.target.value })} aria-label="Due from" />
                <span className="text-muted">–</span>
                <input type="date" className="field border-0 px-1" value={f.dueTo} onChange={(e) => set({ dueTo: e.target.value })} aria-label="Due to" />
              </div>
            )
          },
          {
            key: 'blockedOnly',
            render: (f, set) => (
              <button
                className={`btn-ghost justify-start ${f.blockedOnly ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/40 dark:text-red-300' : ''}`}
                onClick={() => set({ blockedOnly: !f.blockedOnly })}
              >
                <AlertTriangle size={14} /> Blocked only
              </button>
            )
          },
          {
            key: 'tagIds',
            render: (f, set) => {
              const selectedTags = filterOptions.tags.filter((t) => f.tagIds.includes(t.id));
              return (
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-semibold ${selectedTags.length ? 'text-primary' : 'text-muted'}`}>
                    Tags{selectedTags.length ? ` (${selectedTags.length})` : ''}
                  </span>
                  <TagMultiSelect
                    selectedTags={selectedTags}
                    availableTags={filterOptions.tags}
                    onAdd={(tagId) => set({ tagIds: [...f.tagIds, tagId] })}
                    onRemove={(tagId) => set({ tagIds: f.tagIds.filter((tid) => tid !== tagId) })}
                  />
                </div>
              );
            }
          }
        ]}
      />

      {activeFilterCount > 0 && (
        <p className="mt-2 px-1 text-xs text-muted">Showing {tasks.length} of {rawTasks.length} in this bucket</p>
      )}

      <div className="card mt-3 divide-y divide-slate-100 dark:divide-slate-700">
        {tasks.length === 0 && (
          <div className="p-6 text-center text-muted">
            {activeFilterCount > 0 ? 'No tasks match these filters.' : 'Nothing here.'}
          </div>
        )}
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onOpen={() => setOpenTask({ taskId: task.id, projectId: task.projectId })} />
        ))}
      </div>

      {openTask && (
        <InlineTaskModal
          projectId={openTask.projectId}
          taskId={openTask.taskId}
          onUpdated={applyTaskUpdate}
          onClose={() => {
            setOpenTask(null);
            // Background consistency pass on top of the immediate targeted
            // update above -- catches anything that changes which bucket a
            // task belongs to beyond "now done" (e.g. a due-date edit that
            // makes it newly overdue), and deletes, which have no onUpdated.
            loadTasks();
          }}
        />
      )}
    </main>
  );
}

function TaskRow({ task, onOpen }) {
  const priority = priorityMeta[task.priority || 'NONE'];
  return (
    <button
      className="flex w-full flex-col gap-1.5 px-3 py-3 text-left text-sm transition hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-3"
      onClick={onOpen}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">
          {task.customId && <span className="id-badge mr-1.5 align-middle" title={`TID ${task.customId}`} aria-label={`TID ${task.customId}`}>{task.customId}</span>}
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {task.project?.title}
          {task.gate?.name ? ` · ${task.gate.name}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {task.tags?.map((tag) => <span key={tag.id} className={`chip ${tagColorClass(tag.id)}`}>{tag.name}</span>)}
        {task.focus && <span className="chip bg-amber-50 text-amber-700">Focus</span>}
        {task.priority && task.priority !== 'NONE' && <span className={`chip ${priority.className}`}>{priority.label}</span>}
        {task.dueDate && (
          <span className={`chip ${isOverdue(task) ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-muted'}`}>{formatDueDate(task.dueDate)}</span>
        )}
        {task.source && task.source !== 'manual' && <span className="chip bg-purple-50 text-purple-700">{task.source}</span>}
      </div>
    </button>
  );
}
