import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

export default function ProjectTabs({ projectId, active, tasksTo, onNewEntry }) {
  const navigate = useNavigate();

  return (
    <div className="border-b border-border bg-white px-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-1 pb-2 pt-1">
        <div className="flex gap-1">
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
        {active === 'tasks' && (
          <button className="btn-ghost" onClick={() => navigate(`/projects/${projectId}/board`)}>
            Whole-project board
          </button>
        )}
        {active === 'docs' && onNewEntry && (
          <button className="btn-primary" onClick={onNewEntry}>
            New entry
          </button>
        )}
      </div>
    </div>
  );
}
