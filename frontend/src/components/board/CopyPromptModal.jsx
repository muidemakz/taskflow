import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { docsApi } from '../../api/endpoints';

// Only shown when the project has a prompt_rules_category set -- otherwise
// PromptsPanel copies the prompt body directly, no picker needed.
export default function CopyPromptModal({ projectId, categoryId, promptBody, onClose }) {
  const [docs, setDocs] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    docsApi.list(projectId, { categoryId, status: 'ACTIVE' }).then(({ data }) => setDocs(data));
  }, [projectId, categoryId]);

  function toggle(docId) {
    setSelected((prev) => (prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]));
  }

  async function copy() {
    const rules = (docs || [])
      .filter((doc) => selected.includes(doc.id))
      .map((doc) => doc.body)
      .join('\n\n');
    const assembled = rules ? `${rules}\n\n---\n\n${promptBody}` : promptBody;
    await navigator.clipboard.writeText(assembled);
    toast.success('Prompt copied');
    onClose();
  }

  return (
    <Modal
      title="Copy prompt"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={copy}>
            {selected.length ? `Copy with ${selected.length} doc${selected.length === 1 ? '' : 's'}` : 'Copy prompt only'}
          </button>
        </div>
      }
    >
      {docs === null && <p className="text-sm text-muted">Loading rules docs...</p>}
      {docs !== null && !docs.length && <p className="text-sm text-muted">No active docs in the rules category.</p>}
      <div className="space-y-1">
        {(docs || []).map((doc) => (
          <label key={doc.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={selected.includes(doc.id)} onChange={() => toggle(doc.id)} />
            <span className="min-w-0 flex-1 truncate">{doc.title}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
