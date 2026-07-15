import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

// Generic reusable "what will be deleted" confirmation, reused across
// Project/Task/Gate/Tag deletes rather than each screen inventing its own.
export default function DeleteConfirmModal({ title, warning, confirmLabel = 'Delete', onConfirm, onClose, loading = false }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex gap-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div>{warning}</div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          className="btn-primary bg-red-600 hover:bg-red-700"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
