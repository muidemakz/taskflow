import { ChevronRight, Inbox } from 'lucide-react';

export default function UnscheduledCard({ count, onOpen }) {
  return (
    <button className="card flex flex-col gap-3 p-4 text-left transition hover:border-blue-200" onClick={onOpen}>
      <div className="flex items-center gap-2">
        <Inbox size={16} className="text-muted" />
        <h3 className="font-semibold">Unscheduled</h3>
      </div>
      <p className="text-sm text-muted">{count} task{count === 1 ? '' : 's'} not yet assigned to a gate</p>
      <span className="flex items-center gap-1 text-sm font-semibold text-primary">Assign to gate <ChevronRight size={15} /></span>
    </button>
  );
}
