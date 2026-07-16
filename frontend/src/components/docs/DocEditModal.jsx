import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { docsApi } from '../../api/endpoints';

// doc omitted -> create mode. doc provided -> edit mode.
export default function DocEditModal({ projectId, doc, categories, onClose, onSaved }) {
  const [title, setTitle] = useState(doc?.title || '');
  const [categoryId, setCategoryId] = useState(doc?.categoryId || '');
  const [status, setStatus] = useState(doc?.status || 'ACTIVE');
  const [body, setBody] = useState(doc?.body || '');
  const [saving, setSaving] = useState(false);

  const dirty = doc
    ? title !== doc.title || (categoryId || null) !== (doc.categoryId || null) || status !== doc.status || body !== doc.body
    : Boolean(title.trim() || body.trim());

  function handleCancel() {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return;
    onClose();
  }

  async function handleSave() {
    if (!title.trim()) return toast.error('Title is required');
    if (!body.trim()) return toast.error('Body is required');
    setSaving(true);
    try {
      const payload = { title: title.trim(), body, status, category_id: categoryId || null };
      const { data } = doc
        ? await docsApi.update(projectId, doc.id, payload)
        : await docsApi.create(projectId, payload);
      toast.success(doc ? 'Doc saved' : 'Doc created');
      onSaved(data);
    } catch {
      toast.error('Could not save doc');
      setSaving(false);
    }
  }

  return (
    <Modal
      title={doc ? 'Edit entry' : 'New entry'}
      onClose={handleCancel}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={handleCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Title</label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entry title" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Category</label>
            <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Status</label>
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Body (Markdown)</label>
          <textarea
            className="field min-h-64 font-mono text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'# Heading\n\nWrite in Markdown...'}
          />
        </div>
      </div>
    </Modal>
  );
}
