import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';

// Shared by GateShareModal and TaskShareModal use sites -- both gate and
// task share tokens are lazily generated (nullable until first enabled),
// unlike Project.shareToken which exists eagerly from creation, so this
// only shows a link once shareToken is actually set.
export default function EntityShareModal({ title, entity, onToggleShare, onClose }) {
  const shareUrl = entity.shareToken ? `${window.location.origin}/share/${entity.shareToken}` : null;

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Turn sharing on to create a public read-only link.</p>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => onToggleShare(true)}>Enable sharing</button>
        <button className="btn-ghost" onClick={() => onToggleShare(false)}>Disable sharing</button>
      </div>
      {entity.shareEnabled && shareUrl && (
        <div className="mt-4 flex gap-2">
          <input className="field" readOnly value={shareUrl} />
          <button className="btn-icon" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Share URL copied'); }} aria-label="Copy link">
            <Copy size={16} />
          </button>
        </div>
      )}
    </Modal>
  );
}
