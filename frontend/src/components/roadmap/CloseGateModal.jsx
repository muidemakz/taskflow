import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { useBoardStore } from '../../store/boardStore';

function announceResult(result) {
  if (result.action === 'ROLL_TO_NEXT_GATE') toast.success(`Moved ${result.movedCount} task(s) to the next gate`);
  else if (result.action === 'NO_NEXT_GATE') toast.error(`${result.incompleteRemaining} incomplete task(s) have no next gate to roll into`);
  else toast.success('Gate closed');
}

// Reason is collected up front (before any API call) so it's available for
// both the unconfirmed check and the confirmed close -- the backend only
// persists it on the terminal write, but expects it resent on both calls.
export default function CloseGateModal({ gate, onClose, onDone }) {
  const closeGate = useBoardStore((s) => s.closeGate);
  const [step, setStep] = useState('reason');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function submitReason() {
    setLoading(true);
    try {
      const res = await closeGate(gate.id, false, reason.trim() || null);
      if (res.action === 'NEEDS_CONFIRMATION') {
        setResult(res);
        setStep('confirm-rollover');
        setLoading(false);
      } else {
        announceResult(res);
        onDone();
      }
    } catch {
      toast.error('Could not close gate');
      setLoading(false);
    }
  }

  async function confirmRollover() {
    setLoading(true);
    try {
      const final = await closeGate(gate.id, true, reason.trim() || null);
      announceResult(final);
      onDone();
    } catch {
      toast.error('Could not close gate');
      setLoading(false);
    }
  }

  if (step === 'confirm-rollover') {
    return (
      <Modal title={`Close ${gate.name}`} onClose={onClose}>
        <p className="mb-3 text-sm text-muted">
          {result.incompleteTasks.length} incomplete task{result.incompleteTasks.length === 1 ? '' : 's'} will roll over to the next gate:
        </p>
        <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
          {result.incompleteTasks.map((t) => <li key={t.id} className="truncate">{t.title}</li>)}
        </ul>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-primary" onClick={confirmRollover} disabled={loading}>{loading ? 'Closing…' : 'Roll over & close'}</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Close ${gate.name}`} onClose={onClose}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Reason (optional)</label>
      <textarea
        className="field min-h-20"
        placeholder="e.g. All deliverables shipped, blocked on legal sign-off"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="btn-primary" onClick={submitReason} disabled={loading}>{loading ? 'Closing…' : 'Close gate'}</button>
      </div>
    </Modal>
  );
}
