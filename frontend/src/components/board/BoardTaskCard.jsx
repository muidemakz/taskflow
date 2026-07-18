import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Flag, GripVertical, MessageSquare, MoveHorizontal, Star } from 'lucide-react';
import { formatDueDate, isOverdue, priorityMeta, tagColorClass } from '../../utils/board';

export default function BoardTaskCard({ task, onTap, onMoveTap, gatesById = {}, dragDisabled = false }) {
  const sortable = useSortable({ id: task.id, data: { type: 'task', statusId: task.statusId }, disabled: dragDisabled });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1
  };
  const priority = priorityMeta[task.priority || 'NONE'];
  const movedFromGateName = task.movedFromGateId && gatesById[task.movedFromGateId]?.name;

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className="card cursor-pointer p-3 text-left transition hover:border-blue-200"
      onClick={() => onTap?.(task)}
    >
      <div className="flex items-start gap-2">
        {!dragDisabled && (
          <button
            className="mt-0.5 hidden shrink-0 cursor-grab touch-none text-slate-400 sm:block"
            {...sortable.attributes}
            {...sortable.listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to move"
          >
            <GripVertical size={14} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">
            {task.customId && <span className="id-badge mr-1.5 align-middle" title={`TID ${task.customId}`} aria-label={`TID ${task.customId}`}>{task.customId}</span>}
            {task.title}
          </p>
          {task.tags?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span key={tag.id} className={`chip ${tagColorClass(tag.id)}`}>{tag.name}</span>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {task.priority && task.priority !== 'NONE' && (
              <span className={`chip ${priority.className}`}><Flag size={11} className="mr-0.5" />{priority.label}</span>
            )}
            {task.blocked && (
              <span className="chip bg-red-50 text-red-700"><AlertTriangle size={11} className="mr-0.5" />Blocked</span>
            )}
            {task.focus && (
              <span className="chip bg-amber-50 text-amber-700"><Star size={11} className="mr-0.5" />Focus</span>
            )}
            {task.dueDate && (
              <span className={`chip ${isOverdue(task) ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-muted'}`}>
                {formatDueDate(task.dueDate)}
              </span>
            )}
            {task.comment && <MessageSquare size={13} className="text-slate-400" aria-label="Has comment" />}
          </div>
          {movedFromGateName && <p className="mt-1.5 text-[11px] text-muted">Moved from {movedFromGateName}</p>}
        </div>
        {!dragDisabled && (
          <button
            className="btn-icon h-7 w-7 shrink-0 sm:hidden"
            onClick={(e) => { e.stopPropagation(); onMoveTap?.(task); }}
            aria-label="Move task"
          >
            <MoveHorizontal size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
