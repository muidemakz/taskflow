import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import InlineTaskModal from '../components/board/InlineTaskModal';
import MyTasksFilterBar, { EMPTY_MY_TASK_FILTERS, countActiveMyTaskFilters } from '../components/MyTasksFilterBar';
import { meApi, projectsApi, roadmapApi, boardApi } from '../api/endpoints';
import { formatDueDate, isOverdue, priorityMeta, tagColorClass } from '../utils/board';

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
      const { data } = await projectsApi.createTask(quickProjectId, { title });
      // No gate picked -> leave it Unscheduled, exactly what createTask
      // already does by default; only move it when the user chose one.
      if (quickGateId) await boardApi.updateTask(data.taskId, { gateId: quickGateId });
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
    <main className="mx-auto max-w-3xl px-4 py-6">
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

      <MyTasksFilterBar
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        onClear={() => setFilters(EMPTY_MY_TASK_FILTERS)}
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
          onClose={() => {
            setOpenTask(null);
            // Reload the buckets so any edit (or delete) made in the modal
            // is reflected in the rows -- the view itself never navigates.
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
          {task.customId && <span className="id-badge mr-1.5 align-middle">{task.customId}</span>}
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
