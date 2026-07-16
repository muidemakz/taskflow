import { Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';

export default function ShareProjectModal({ project, onToggleShare, onClose }) {
  const shareUrl = `${window.location.origin}/share/${project.shareToken}`;

  return (
    <Modal title="Share project" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Turn sharing on to create a public read-only project URL.</p>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => onToggleShare(true)}>Enable sharing</button>
        <button className="btn-ghost" onClick={() => onToggleShare(false)}>Disable sharing</button>
      </div>
      {project.shareEnabled && (
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
