import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { shareApi } from '../api/endpoints';
import GroupCard from '../components/GroupCard';
import ProgressBar from '../components/ProgressBar';
import TaskCard from '../components/TaskCard';
import { stats, visibleEntries } from '../utils/project';

const initialFilters = { query: '', status: 'all', completedAfter: '', sort: 'default' };

export default function ShareView() {
  const { shareToken } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  useEffect(() => {
    shareApi.detail(shareToken)
      .then(({ data }) => setProject(data))
      .catch((err) => setError(err.response?.data?.message || 'This project is no longer shared'));
  }, [shareToken]);

  if (error) {
    return <main className="flex min-h-screen items-center justify-center p-4"><div className="card max-w-md p-6 text-center"><h1 className="text-xl font-bold">Share unavailable</h1><p className="mt-2 text-muted">{error}</p></div></main>;
  }
  if (!project) return <div className="p-8 text-center text-muted">Loading shared project...</div>;
  const st = stats(project);
  const entries = visibleEntries(project, filters);
  const visibleCount = entries.reduce((sum, entry) => sum + (entry.type === 'task' ? 1 : entry.tasks.length), 0);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-primary">
        Viewing shared project — {project.owner?.name}'s {project.title}
      </div>
      <section className="card mb-5 p-5">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="mt-2 text-muted">{project.description}</p>
        <div className="mt-4">
          <ProgressBar value={st.pct} />
          <p className="mt-2 text-sm text-muted">{st.done} of {st.total} done · {st.pct}%</p>
        </div>
        <Link className="btn-primary mt-5" to="/register">Create your own Taskflow account <ArrowRight size={16} /></Link>
      </section>

      <section className="card mb-5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field max-w-sm"
            placeholder="Search tasks or comments"
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
          />
          <div className="rounded-md border border-[#d8e0ea] bg-white p-1">
            {['all', 'TODO', 'DONE'].map((value) => (
              <button
                key={value}
                className={`rounded px-3 py-1.5 text-sm font-semibold ${filters.status === value ? 'bg-primary text-white' : 'text-muted'}`}
                onClick={() => setFilters({ ...filters, status: value })}
              >
                {value === 'all' ? 'All' : value === 'TODO' ? 'To-do' : 'Done'}
              </button>
            ))}
          </div>
          <input
            className="field w-auto"
            type="date"
            value={filters.completedAfter}
            aria-label="Completed on or after"
            onChange={(event) => setFilters({ ...filters, completedAfter: event.target.value })}
          />
          <select className="field w-auto" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
            <option value="default">Default order</option>
            <option value="todo-first">To-do first</option>
            <option value="done-first">Completed first</option>
            <option value="completed-desc">Newest completed</option>
            <option value="completed-asc">Oldest completed</option>
          </select>
          <span className="text-sm text-muted">{visibleCount} visible</span>
        </div>
      </section>

      <div className="space-y-3">
        {entries.length === 0 && <div className="card p-6 text-center text-muted">No tasks match this filter.</div>}
        {entries.map((entry) => entry.type === 'task'
          ? <TaskCard key={entry.key} task={entry.item} readOnly />
          : <GroupCard key={entry.key} group={entry.item} groups={project.groups} readOnly />)}
      </div>
    </main>
  );
}
