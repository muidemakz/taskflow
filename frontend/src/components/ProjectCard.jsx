import { ArrowRight, Trash2 } from 'lucide-react';
import ProgressBar from './ProgressBar';
import { formatDate, stats } from '../utils/project';

export default function ProjectCard({ project, onOpen, onDelete }) {
  const st = stats(project);
  return (
    <button onClick={onOpen} className="card group flex flex-col gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold leading-snug">{project.title}</h3>
          <p className="mt-1 text-sm text-muted">
            {project.metrics ? `${project.metrics.gateCount} gate${project.metrics.gateCount === 1 ? '' : 's'} · ${project.metrics.taskCount} task${project.metrics.taskCount === 1 ? '' : 's'}` : `created ${formatDate(project.createdAt)}`}
          </p>
        </div>
        <span
          className="btn-icon text-red-700 hover:bg-red-50"
          onClick={(event) => { event.stopPropagation(); onDelete(); }}
          role="button"
          tabIndex={0}
        >
          <Trash2 size={16} />
        </span>
      </div>
      <div>
        <ProgressBar value={st.pct} />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted">{st.done} of {st.total} done</span>
          <span className="font-semibold text-primary">{st.pct}%</span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-muted">
        <span>Open project</span>
        <ArrowRight size={16} className="transition group-hover:translate-x-1" />
      </div>
    </button>
  );
}
