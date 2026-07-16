import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
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

export default function MyTasks() {
  const navigate = useNavigate();
  const [buckets, setBuckets] = useState(null);
  const [activeTab, setActiveTab] = useState('today');
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

  if (!buckets) return <main className="p-8 text-center text-muted">Loading your tasks...</main>;

  const tasks = buckets[activeTab] || [];

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
              activeTab === tab.key ? 'border-primary bg-primary text-white' : 'border-[#d8e0ea] bg-white text-muted'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label} <span className="ml-1 opacity-80">{buckets[tab.key]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="card mt-3 divide-y divide-slate-100">
        {tasks.length === 0 && <div className="p-6 text-center text-muted">Nothing here.</div>}
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onOpen={() => navigate(`/projects/${task.projectId}/board?taskId=${task.id}`)} />
        ))}
      </div>
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
        <p className="font-medium leading-snug">{task.title}</p>
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
