import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { useBoardStore } from '../../store/boardStore';

function announceResult(result) {
  if (result.action === 'ROLL_TO_NEXT_GATE') toast.success(`Moved ${result.movedCount} task(s) to the next gate`);
  else if (result.action === 'NO_NEXT_GATE') toast.error(`${result.incompleteRemaining} incomplete task(s) have no next gate to roll into`);
  else toast.success('Gate closed');
}

// Two-step flow only for ask_first with incomplete tasks: the first
// (unconfirmed) call already fully executes automatic-mode rollover, "no
// rollover needed", and "no next gate" outcomes server-side.
export default function CloseGateModal({ gate, onClose, onDone }) {
  const closeGate = useBoardStore((s) => s.closeGate);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    closeGate(gate.id, false)
      .then((res) => {
        if (cancelled) return;
        if (res.action === 'NEEDS_CONFIRMATION') {
          setResult(res);
          setLoading(false);
        } else {
          announceResult(res);
          onDone();
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Could not close gate');
          onClose();
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate.id]);

  async function confirmRollover() {
    setLoading(true);
    try {
      const final = await closeGate(gate.id, true);
      announceResult(final);
      onDone();
    } catch {
      toast.error('Could not close gate');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Modal title={`Close ${gate.name}`} onClose={onClose}>
        <p className="text-sm text-muted">Checking for incomplete tasks…</p>
      </Modal>
    );
  }

  return (
    <Modal title={`Close ${gate.name}`} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        {result.incompleteTasks.length} incomplete task{result.incompleteTasks.length === 1 ? '' : 's'} will roll over to the next gate:
      </p>
      <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
        {result.incompleteTasks.map((t) => <li key={t.id} className="truncate">{t.title}</li>)}
      </ul>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={confirmRollover}>Roll over &amp; close</button>
      </div>
    </Modal>
  );
}
