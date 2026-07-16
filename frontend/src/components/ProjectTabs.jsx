import { Link } from 'react-router-dom';

export default function ProjectTabs({ projectId, active, tasksTo }) {
  return (
    <div className="border-b border-border bg-white px-4">
      <div className="mx-auto flex max-w-6xl gap-1 pb-2 pt-1">
        <Link
          to={tasksTo || `/projects/${projectId}`}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${active === 'tasks' ? 'bg-primary text-white' : 'text-muted hover:bg-slate-50'}`}
        >
          Tasks
        </Link>
        <Link
          to={`/projects/${projectId}/docs`}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${active === 'docs' ? 'bg-primary text-white' : 'text-muted hover:bg-slate-50'}`}
        >
          Docs
        </Link>
      </div>
    </div>
  );
}
