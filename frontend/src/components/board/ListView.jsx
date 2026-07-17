import { AlertTriangle, Flag, MessageSquare, Star } from 'lucide-react';
import { formatDueDate, isOverdue, priorityMeta, sortTasks, statusDotColor, tagColorClass } from '../../utils/board';

export default function ListView({ columns, sortKey, workflowContext, onOpenTask }) {
  return (
    <div className="space-y-5">
      {columns.map((col) => {
        const tasks = sortTasks(col.tasks, sortKey, workflowContext);
        if (!tasks.length) return null;
        return (
          <section key={col.status.id}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${statusDotColor(col.status)}`} />
              <h3 className="text-sm font-semibold">{col.status.name}</h3>
              <span className="chip bg-slate-100 text-muted">{tasks.length}</span>
            </div>
            <div className="card divide-y divide-slate-100">
              {tasks.map((task) => (
                <ListRow key={task.id} task={task} status={col.status} onOpenTask={onOpenTask} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ListRow({ task, status, onOpenTask }) {
  const priority = priorityMeta[task.priority || 'NONE'];
  return (
    <button
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 sm:gap-3"
      onClick={() => onOpenTask?.(task)}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotColor(status)}`} />
      {task.customId && <span className="id-badge shrink-0">{task.customId}</span>}
      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {task.tags?.slice(0, 2).map((tag) => (
          <span key={tag.id} className={`chip hidden sm:inline-flex ${tagColorClass(tag.id)}`}>{tag.name}</span>
        ))}
        {task.focus && <Star size={14} className="text-amber-500" aria-label="Focus" />}
        {task.blocked && <AlertTriangle size={14} className="text-red-600" aria-label="Blocked" />}
        {task.priority && task.priority !== 'NONE' && (
          <span className={`chip ${priority.className}`}><Flag size={11} className="mr-0.5" />{priority.label}</span>
        )}
        {task.dueDate && (
          <span className={`chip ${isOverdue(task) ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-muted'}`}>
            {formatDueDate(task.dueDate)}
          </span>
        )}
        {task.comment && <MessageSquare size={13} className="text-slate-400" aria-label="Has comment" />}
      </div>
    </button>
  );
}
