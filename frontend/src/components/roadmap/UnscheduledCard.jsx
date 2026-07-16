import { ChevronRight, Inbox, Plus } from 'lucide-react';

export default function UnscheduledCard({ count, onOpen, onAddTask }) {
  return (
    <div className="card flex flex-col gap-3 p-4">
      <button className="flex flex-col gap-3 text-left" onClick={onOpen}>
        <div className="flex items-center gap-2">
          <Inbox size={16} className="text-muted" />
          <h3 className="font-semibold">Unscheduled</h3>
        </div>
        <p className="text-sm text-muted">{count} task{count === 1 ? '' : 's'} not yet assigned to a gate</p>
        <span className="flex items-center gap-1 text-sm font-semibold text-primary">Assign to gate <ChevronRight size={15} /></span>
      </button>
      <button className="btn-ghost justify-center" onClick={() => onAddTask?.()}>
        <Plus size={14} /> Add task
      </button>
    </div>
  );
}
