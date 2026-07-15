import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { syncApi } from '../api/endpoints';

const SWIPE_THRESHOLD = 90;

export default function CatchUp() {
  const [proposals, setProposals] = useState(null);

  function load() {
    syncApi.proposals('PENDING').then(({ data }) => setProposals(data));
  }

  useEffect(() => { load(); }, []);

  async function accept(id) {
    try {
      await syncApi.accept(id);
      setProposals((prev) => prev.filter((p) => p.id !== id));
      window.dispatchEvent(new Event('taskflow:proposals-changed'));
      toast.success('Accepted');
    } catch {
      toast.error('Could not accept proposal');
    }
  }

  async function dismiss(id) {
    try {
      await syncApi.dismiss(id);
      setProposals((prev) => prev.filter((p) => p.id !== id));
      window.dispatchEvent(new Event('taskflow:proposals-changed'));
      toast.success('Dismissed');
    } catch {
      toast.error('Could not dismiss proposal');
    }
  }

  if (!proposals) return <main className="p-8 text-center text-muted">Loading review queue...</main>;

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-xl font-bold">Catch-up</h1>
      <p className="mt-1 text-sm text-muted">Status changes proposed from synced sources, waiting on your review.</p>

      {proposals.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-muted">You&apos;re all caught up.</div>
      ) : (
        <div className="mt-5 space-y-3">
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onAccept={() => accept(p.id)} onDismiss={() => dismiss(p.id)} />
          ))}
        </div>
      )}
    </main>
  );
}

function ProposalCard({ proposal, onAccept, onDismiss }) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);

  function onPointerDown(e) {
    draggingRef.current = true;
    setDragging(true);
    startXRef.current = e.clientX;
  }

  function onPointerMove(e) {
    if (!draggingRef.current) return;
    setDragX(e.clientX - startXRef.current);
  }

  function onPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (dragX > SWIPE_THRESHOLD) onAccept();
    else if (dragX < -SWIPE_THRESHOLD) onDismiss();
    setDragX(0);
  }

  const currentStatusName = proposal.task.taskStatus?.name || 'Unscheduled';
  const projectTitle = proposal.task.project?.title || '';

  return (
    <div
      className="card touch-pan-y relative select-none p-4"
      style={{
        transform: `translateX(${dragX}px) rotate(${dragX / 25}deg)`,
        transition: dragging ? 'none' : 'transform 0.2s ease',
        borderColor: dragX > SWIPE_THRESHOLD ? '#a7f3d0' : dragX < -SWIPE_THRESHOLD ? '#fecaca' : undefined
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="min-w-0">
        <p className="font-semibold leading-snug">{proposal.task.title}</p>
        <p className="text-xs text-muted">{projectTitle}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium">
        <span className="chip bg-slate-100 text-muted">{currentStatusName}</span>
        <ArrowRight size={14} className="text-slate-400" />
        <span className="chip bg-emerald-50 text-emerald-700">{proposal.proposedStatus.name}</span>
      </div>

      <p className="mt-3 text-sm text-muted">{proposal.reason}</p>

      <div className="mt-2 text-xs text-muted">
        Source:{' '}
        {proposal.sourceUrl ? (
          <a href={proposal.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline">{proposal.source}</a>
        ) : (
          proposal.source
        )}
      </div>

      <div className="mt-4 hidden gap-2 sm:flex">
        <button className="btn-ghost flex-1 text-red-700 hover:bg-red-50" onClick={onDismiss}>
          <X size={15} /> Dismiss
        </button>
        <button className="btn-primary flex-1" onClick={onAccept}>
          <Check size={15} /> Accept
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted sm:hidden">Swipe right to accept, left to dismiss</p>
    </div>
  );
}
