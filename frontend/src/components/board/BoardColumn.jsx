import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import BoardTaskCard from './BoardTaskCard';

export default function BoardColumn({ status, tasks, onCardTap, onOpenMoveSheet, gatesById }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${status.id}`, data: { type: 'column', statusId: status.id } });

  return (
    <div className="flex w-[85vw] max-w-[320px] shrink-0 snap-start flex-col sm:w-72 sm:snap-align-none">
      <div className="mb-2 flex items-center gap-2 px-1">
        <h3 className="text-sm font-semibold">{status.name}</h3>
        <span className="chip bg-slate-100 text-muted">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[140px] flex-1 flex-col gap-2 rounded-lg p-1 transition-colors ${isOver ? 'bg-blue-50/60' : ''}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <BoardTaskCard key={task.id} task={task} onTap={onCardTap} onMoveTap={onOpenMoveSheet} gatesById={gatesById} />
          ))}
        </SortableContext>
        {!tasks.length && (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted">No tasks</div>
        )}
      </div>
    </div>
  );
}
