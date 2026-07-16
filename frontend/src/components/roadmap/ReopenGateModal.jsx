import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { useBoardStore } from '../../store/boardStore';

export default function ReopenGateModal({ gate, onClose, onDone }) {
  const reopenGate = useBoardStore((s) => s.reopenGate);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      await reopenGate(gate.id, reason.trim() || null);
      toast.success('Gate reopened');
      onDone();
    } catch {
      toast.error('Could not reopen gate');
      setLoading(false);
    }
  }

  return (
    <Modal title={`Reopen ${gate.name}`} onClose={onClose}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Reason (optional)</label>
      <textarea
        className="field min-h-20"
        placeholder="Why is this gate reopening?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="btn-primary" onClick={confirm} disabled={loading}>{loading ? 'Reopening…' : 'Reopen gate'}</button>
      </div>
    </Modal>
  );
}
