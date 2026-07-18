import { DoorClosed, DoorOpen, Plus, Share2 } from 'lucide-react';
import ProgressBar from '../ProgressBar';

function gateLetter(order) {
  return String.fromCharCode(65 + (order ?? 0));
}

function formatClosedDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Sub-level sibling of the project detail card: same radius / shadow /
// progress-bar language, but a tinted surface and a left accent stripe
// coloured by gate order (--gate-accent, cycling A->F). More compact than
// the project card -- smaller title, single-line metadata -- with the
// Open/Closed pill pinned top-right like the roadmap gate cards.
export default function GateDetailCard({ gate, onAddTask, onShareGate, onCloseGate, onReopenGate }) {
  const { total, done, pct } = gate.progress || { total: 0, done: 0, pct: 0 };
  const isClosed = gate.status === 'CLOSED';

  return (
    <section
      className="gate-detail-card relative mb-4 p-4"
      style={{ '--gate-accent': `var(--gate-accent-${(gate.order ?? 0) % 6})` }}
    >
      <div className="absolute right-3 top-3">
        {isClosed ? (
          <span className="chip bg-slate-100 text-muted dark:bg-slate-700 dark:text-slate-300">
            <DoorClosed size={11} className="mr-1" />Closed{gate.closedAt ? ` · ${formatClosedDate(gate.closedAt)}` : ''}
          </span>
        ) : (
          <span className="chip bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <DoorOpen size={11} className="mr-1" />Open
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2 pr-24">
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
          style={{ background: `var(--gate-accent-${(gate.order ?? 0) % 6})` }}
        >
          {gateLetter(gate.order)}
        </span>
        <h2 className="min-w-0 truncate text-base font-bold">{gate.name}</h2>
      </div>

      {isClosed && gate.closedReason && (
        <p className="mt-1.5 text-xs italic text-muted">&ldquo;{gate.closedReason}&rdquo;</p>
      )}

      <div className="mt-3">
        <ProgressBar value={pct} />
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="text-muted">{done} of {total} done · {pct}%</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {onAddTask && (
          <button className="btn-ghost" onClick={() => onAddTask(gate)}>
            <Plus size={14} /> Add task
          </button>
        )}
        {onShareGate && (
          <button className="btn-icon" onClick={() => onShareGate(gate)} aria-label="Share gate">
            <Share2 size={15} />
          </button>
        )}
        {isClosed
          ? onReopenGate && (
              <button className="btn-ghost" onClick={() => onReopenGate(gate)}>
                <DoorOpen size={15} /> Reopen gate
              </button>
            )
          : onCloseGate && (
              <button className="btn-ghost" onClick={() => onCloseGate(gate)}>
                <DoorClosed size={15} /> Close gate
              </button>
            )}
      </div>
    </section>
  );
}
