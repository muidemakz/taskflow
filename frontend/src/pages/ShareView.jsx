import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, DoorClosed, Flag } from 'lucide-react';
import { shareApi } from '../api/endpoints';
import ProgressBar from '../components/ProgressBar';
import ActivityTimelineList from '../components/board/ActivityTimelineList';
import { formatDueDate, isOverdue, priorityMeta, statusDotColor, tagColorClass } from '../utils/board';

function CreateAccountCta() {
  return <Link className="btn-primary mt-5" to="/register">Create your own Taskflow account <ArrowRight size={16} /></Link>;
}

function StatusColumns({ statuses }) {
  return (
    <div className="space-y-4">
      {statuses.map((status) => (
        <section key={status.id}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className={`h-2 w-2 rounded-full ${statusDotColor(status)}`} />
            <h3 className="text-sm font-semibold">{status.name}</h3>
            <span className="chip bg-slate-100 text-muted">{status.tasks.length}</span>
          </div>
          {status.tasks.length === 0 ? (
            <div className="card p-4 text-center text-sm text-muted">No tasks in this status.</div>
          ) : (
            <div className="card divide-y divide-slate-100">
              {status.tasks.map((task) => {
                const priority = priorityMeta[task.priority || 'NONE'];
                return (
                  <div key={task.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 font-medium">{task.title}</span>
                    {task.gateName && <span className="chip bg-purple-50 text-purple-700">{task.gateName}</span>}
                    {task.tags?.slice(0, 3).map((tag) => (
                      <span key={tag.id} className={`chip ${tagColorClass(tag.id)}`}>{tag.name}</span>
                    ))}
                    {task.blocked && <span className="chip bg-red-50 text-red-700"><AlertTriangle size={11} className="mr-0.5" />Blocked</span>}
                    {task.priority && task.priority !== 'NONE' && (
                      <span className={`chip ${priority.className}`}><Flag size={11} className="mr-0.5" />{priority.label}</span>
                    )}
                    {task.dueDate && (
                      <span className={`chip ${isOverdue(task) ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-muted'}`}>{formatDueDate(task.dueDate)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function ProjectShareView({ data }) {
  return (
    <>
      <section className="card mb-5 p-5">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        {data.description && <p className="mt-2 text-muted">{data.description}</p>}
        <div className="mt-4">
          <ProgressBar value={data.stats.pct} />
          <p className="mt-2 text-sm text-muted">{data.stats.done} of {data.stats.total} done · {data.stats.pct}%</p>
        </div>
        <CreateAccountCta />
      </section>

      {data.hasRoadmap && data.gates.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Roadmap progress</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.gates.map((gate) => (
              <div key={gate.id} className="card p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{gate.name}</h3>
                  {gate.status === 'CLOSED' && <span className="chip bg-slate-100 text-muted"><DoorClosed size={11} className="mr-1" />Closed</span>}
                </div>
                <div className="mt-2">
                  <ProgressBar value={gate.progress.pct} />
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted">{gate.progress.done}/{gate.progress.total} done</span>
                    <span className="font-semibold text-primary">{gate.progress.pct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <StatusColumns statuses={data.statuses} />
    </>
  );
}

function GateShareView({ data }) {
  const isClosed = data.status === 'CLOSED';
  return (
    <>
      <section className="card mb-5 p-5">
        <p className="text-sm text-muted">{data.projectTitle}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{data.name}</h1>
          {isClosed && <span className="chip bg-slate-100 text-muted"><DoorClosed size={11} className="mr-1" />Closed</span>}
        </div>
        {data.description && <p className="mt-2 text-muted">{data.description}</p>}
        {isClosed && data.closedReason && <p className="mt-2 text-sm italic text-muted">&ldquo;{data.closedReason}&rdquo;</p>}
        <div className="mt-4">
          <ProgressBar value={data.stats.pct} />
          <p className="mt-2 text-sm text-muted">{data.stats.done} of {data.stats.total} done · {data.stats.pct}%</p>
        </div>
        <CreateAccountCta />
      </section>

      <StatusColumns statuses={data.statuses} />
    </>
  );
}

function TaskShareView({ data }) {
  const priority = priorityMeta[data.priority || 'NONE'];
  return (
    <>
      <section className="card mb-5 p-5">
        <p className="text-sm text-muted">{data.projectTitle}</p>
        <h1 className="mt-1 text-2xl font-bold">{data.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {data.statusName && <span className="chip bg-slate-100 text-muted">{data.statusName}</span>}
          {data.gateName && <span className="chip bg-purple-50 text-purple-700">{data.gateName}</span>}
          {data.tags?.map((tag) => <span key={tag.id} className={`chip ${tagColorClass(tag.id)}`}>{tag.name}</span>)}
          {data.blocked && <span className="chip bg-red-50 text-red-700"><AlertTriangle size={11} className="mr-0.5" />Blocked</span>}
          {data.priority && data.priority !== 'NONE' && (
            <span className={`chip ${priority.className}`}><Flag size={11} className="mr-0.5" />{priority.label}</span>
          )}
          {data.dueDate && (
            <span className={`chip ${isOverdue(data) ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-muted'}`}>{formatDueDate(data.dueDate)}</span>
          )}
        </div>
        {data.blocked && data.blockedNote && <p className="mt-3 text-sm italic text-muted">&ldquo;{data.blockedNote}&rdquo;</p>}
        {data.comment && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{data.comment}</p>}
        <CreateAccountCta />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Activity</h2>
        <ActivityTimelineList entries={data.activity} />
      </section>
    </>
  );
}

export default function ShareView() {
  const { shareToken } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    shareApi.detail(shareToken)
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.message || 'This link is no longer shared'));
  }, [shareToken]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-xl font-bold">Share unavailable</h1>
          <p className="mt-2 text-muted">{error}</p>
        </div>
      </main>
    );
  }
  if (!data) return <div className="p-8 text-center text-muted">Loading shared content...</div>;

  const banner = { project: 'Viewing a shared project, read-only', gate: 'Viewing a shared gate, read-only', task: 'Viewing a shared task, read-only' }[data.type];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-primary">{banner}</div>
      {data.type === 'project' && <ProjectShareView data={data} />}
      {data.type === 'gate' && <GateShareView data={data} />}
      {data.type === 'task' && <TaskShareView data={data} />}
    </main>
  );
}
