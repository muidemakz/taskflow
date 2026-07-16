import { ChevronRight, DoorClosed, DoorOpen } from 'lucide-react';
import ProgressBar from '../ProgressBar';

function formatClosedDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Closed gates stay visible and still participate in progress (the pct
// below already comes from the backend counting closed gates the same as
// open ones) -- closed only changes the badge/actions shown here.
export default function GateCard({ gate, onOpen, onCloseGate, onReopenGate }) {
  const { total, done, pct } = gate.progress;
  const isClosed = gate.status === 'CLOSED';

  return (
    <div className="card flex flex-col p-4">
      <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => onOpen(gate)}>
        <div className="min-w-0">
          <h3 className="font-semibold">{gate.name}</h3>
          {isClosed && (
            <span className="chip mt-1 bg-slate-100 text-muted">
              <DoorClosed size={11} className="mr-1" />Closed{gate.closedAt ? ` · ${formatClosedDate(gate.closedAt)}` : ''}
            </span>
          )}
        </div>
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

      {isClosed ? (
        <button className="btn-ghost mt-3 w-full justify-center" onClick={() => onReopenGate(gate)}>
          <DoorOpen size={15} /> Reopen gate
        </button>
      ) : (
        <button className="btn-ghost mt-3 w-full justify-center" onClick={() => onCloseGate(gate)}>
          <DoorClosed size={15} /> Close gate
        </button>
      )}
    </div>
  );
}
