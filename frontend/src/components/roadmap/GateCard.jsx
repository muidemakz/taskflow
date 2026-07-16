import { ChevronRight, DoorClosed, DoorOpen, Plus, Share2 } from 'lucide-react';
import ProgressBar from '../ProgressBar';

function formatClosedDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Closed gates stay visible and still participate in progress (the pct
// below already comes from the backend counting closed gates the same as
// open ones) -- closed only changes the badge/actions shown here. Active
// and Closed badges share one top-right corner position so scanning the
// roadmap always finds gate status in the same spot.
export default function GateCard({ gate, onOpen, onCloseGate, onReopenGate, onAddTask, onShareGate }) {
  const { total, done, pct } = gate.progress;
  const isClosed = gate.status === 'CLOSED';

  return (
    <div className="card relative flex flex-col p-4">
      <div className="absolute right-3 top-3">
        {isClosed ? (
          <span className="chip bg-slate-100 text-muted">
            <DoorClosed size={11} className="mr-1" />Closed{gate.closedAt ? ` · ${formatClosedDate(gate.closedAt)}` : ''}
          </span>
        ) : (
          <span className="chip bg-emerald-50 text-emerald-700"><DoorOpen size={11} className="mr-1" />Active</span>
        )}
      </div>

      <button className="flex w-full items-start gap-2 pr-16 text-left" onClick={() => onOpen(gate)}>
        <h3 className="min-w-0 truncate font-semibold">{gate.name}</h3>
        <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-400" />
      </button>

      {isClosed && gate.closedReason && (
        <p className="mt-2 text-xs italic text-muted">&ldquo;{gate.closedReason}&rdquo;</p>
      )}

      <div className="mt-3">
        <ProgressBar value={pct} />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted">{done}/{total} done</span>
          <span className="font-semibold text-primary">{pct}%</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-ghost flex-1 justify-center" onClick={() => onAddTask?.(gate)}>
          <Plus size={14} /> Add task
        </button>
        <button className="btn-icon" onClick={() => onShareGate?.(gate)} aria-label="Share gate">
          <Share2 size={15} />
        </button>
        {isClosed ? (
          <button className="btn-ghost flex-1 justify-center" onClick={() => onReopenGate(gate)}>
            <DoorOpen size={15} /> Reopen
          </button>
        ) : (
          <button className="btn-ghost flex-1 justify-center" onClick={() => onCloseGate(gate)}>
            <DoorClosed size={15} /> Close
          </button>
        )}
      </div>
    </div>
  );
}
