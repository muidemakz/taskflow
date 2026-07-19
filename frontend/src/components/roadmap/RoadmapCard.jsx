import { useEffect, useRef, useState } from 'react';
import { ChevronRight, DoorClosed, DoorOpen, Inbox, Milestone, MoreVertical, Pencil, Plus, Share2 } from 'lucide-react';
import ProgressBar from '../ProgressBar';

function formatClosedDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// One shared card for Gate and Unscheduled -- they used to be two separate
// components that only agreed by accident (shared ambient CSS classes, not
// a shared structure). Now one component with a `kind` variant, so the
// three intentional differences (progress bar, menu contents, closed
// badge/reason) are the ONLY differences; everything else -- click target,
// icon+title+chevron header, spacing rhythm -- is genuinely shared markup.
//
// Icon choice: Gate gains a `Milestone` icon (previously had none) rather
// than removing Unscheduled's `Inbox` -- an icon-less header would have
// been the odd one out once Unscheduled's stayed, and both readable at a
// glance is better than neither having one.
export default function RoadmapCard({
  kind,
  gate,
  count,
  onOpen,
  onAddTask,
  onCloseGate,
  onReopenGate,
  onShareGate,
  onEditGate,
  onShareProject
}) {
  const isGate = kind === 'gate';
  const isClosed = isGate && gate.status === 'CLOSED';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function runAction(action) {
    setMenuOpen(false);
    action?.(gate);
  }

  return (
    <div className="card relative flex flex-col gap-3 p-4">
      {isGate && (
        <div className="absolute right-3 top-3">
          {isClosed ? (
            <span className="chip bg-slate-100 text-muted">
              <DoorClosed size={11} className="mr-1" />Closed{gate.closedAt ? ` · ${formatClosedDate(gate.closedAt)}` : ''}
            </span>
          ) : (
            <span className="chip bg-emerald-50 text-emerald-700"><DoorOpen size={11} className="mr-1" />Active</span>
          )}
        </div>
      )}

      {/* The whole card opens on click (Unscheduled's original behavior,
          now also Gate's) -- everything below lives inside this <button>
          except "Add task" and the "⋮" menu, which are siblings outside it
          so they can never trigger the card's own click handler. */}
      <button
        type="button"
        className="flex flex-col items-start gap-3 text-left"
        onClick={() => (isGate ? onOpen(gate) : onOpen())}
      >
        <div className="flex w-full items-center gap-2 pr-16">
          {isGate ? <Milestone size={16} className="shrink-0 text-muted" /> : <Inbox size={16} className="shrink-0 text-muted" />}
          <h3 className="min-w-0 flex-1 truncate font-semibold">{isGate ? gate.name : 'Unscheduled'}</h3>
          <ChevronRight size={16} className="shrink-0 text-slate-400" />
        </div>

        {isGate && isClosed && gate.closedReason && (
          <p className="text-xs italic text-muted">&ldquo;{gate.closedReason}&rdquo;</p>
        )}

        {isGate ? (
          <div className="w-full">
            <ProgressBar value={gate.progress.pct} />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted">{gate.progress.done}/{gate.progress.total} done</span>
              <span className="font-semibold text-primary">{gate.progress.pct}%</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">{count} task{count === 1 ? '' : 's'} not yet assigned to a gate</p>
        )}
      </button>

      <div className="flex gap-2">
        <button className="btn-ghost flex-1 justify-center" onClick={() => (isGate ? onAddTask?.(gate) : onAddTask?.())}>
          <Plus size={14} /> Add task
        </button>
        <div className="relative" ref={menuRef}>
          <button className="btn-icon" onClick={() => setMenuOpen((v) => !v)} aria-label={isGate ? 'Gate actions' : 'Unscheduled actions'}>
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="card absolute right-0 z-20 mt-1 w-44 p-1">
              {isGate && (
                isClosed ? (
                  <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => runAction(onReopenGate)}>
                    <DoorOpen size={14} /> Reopen gate
                  </button>
                ) : (
                  <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => runAction(onCloseGate)}>
                    <DoorClosed size={14} /> Close gate
                  </button>
                )
              )}
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => { setMenuOpen(false); isGate ? onShareGate?.(gate) : onShareProject?.(); }}
              >
                <Share2 size={14} /> Share{isGate ? ' gate' : ''}
              </button>
              {isGate && (
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => runAction(onEditGate)}>
                  <Pencil size={14} /> Edit gate
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
