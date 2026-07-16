import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { docsApi, taskDocLinksApi } from '../../api/endpoints';

export default function LinkedDocsPickerModal({ projectId, taskId, linkedDocIds, onClose, onDone }) {
  const [allDocs, setAllDocs] = useState(null);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    docsApi.list(projectId, { status: 'ACTIVE' }).then(({ data }) => setAllDocs(data));
  }, [projectId]);

  const pickable = (allDocs || []).filter((doc) => !linkedDocIds.includes(doc.id));

  function toggle(docId) {
    setSelected((prev) => (prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]));
  }

  async function confirm() {
    if (!selected.length) return onClose();
    setSaving(true);
    try {
      await Promise.all(selected.map((docId) => taskDocLinksApi.add(projectId, taskId, docId)));
      toast.success(`Linked ${selected.length} doc${selected.length === 1 ? '' : 's'}`);
      onDone();
    } catch {
      toast.error('Could not link docs');
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Link docs to this task"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={confirm} disabled={saving || !selected.length}>
            {saving ? 'Linking…' : `Link ${selected.length || ''}`.trim()}
          </button>
        </div>
      }
    >
      {allDocs === null && <p className="text-sm text-muted">Loading docs...</p>}
      {allDocs !== null && !pickable.length && <p className="text-sm text-muted">No more docs to link.</p>}
      <div className="space-y-1">
        {pickable.map((doc) => (
          <label key={doc.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={selected.includes(doc.id)} onChange={() => toggle(doc.id)} />
            <span className="min-w-0 flex-1 truncate">{doc.title}</span>
            <span className="chip shrink-0 bg-slate-100 text-muted">{doc.category?.name || 'Uncategorized'}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
