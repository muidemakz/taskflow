import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import TagMultiSelect from '../TagMultiSelect';
import { projectsApi, boardApi, tagsApi, docsApi, taskDocLinksApi } from '../../api/endpoints';

// Creates via the legacy create-task endpoint (lands in the project's first
// non-done status, Unscheduled) then immediately moves it via the board
// endpoint if a different gate/status was chosen -- reuses that endpoint's
// validation, activity logging, and position handling instead of
// duplicating them in a dedicated create-in-gate endpoint. gate === null
// means Unscheduled (status only, no gate move needed).
//
// Comment/tags/linked docs (checkpoint c.1.3) are optional and collapsed
// behind "Add details" by default so the common single-title-and-save case
// stays fast -- their data only exists once the task does, so they're
// applied as follow-up calls after create, not part of the create payload.
export default function QuickAddTaskModal({ projectId, gate, statuses, onClose, onCreated }) {
  const firstNonDone = statuses.find((s) => !s.countsAsDone) || statuses[0];
  const [title, setTitle] = useState('');
  const [statusId, setStatusId] = useState(firstNonDone?.id || '');
  const [saving, setSaving] = useState(false);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [availableDocs, setAvailableDocs] = useState(null);
  const [selectedDocIds, setSelectedDocIds] = useState([]);

  useEffect(() => {
    if (!detailsOpen || availableDocs !== null) return;
    tagsApi.list(projectId).then(({ data }) => setAvailableTags(data));
    docsApi.list(projectId, { status: 'ACTIVE' }).then(({ data }) => setAvailableDocs(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsOpen]);

  function removeTag(tagId) {
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
  }

  async function createAndAddTag(name) {
    try {
      const { data: tag } = await tagsApi.create(projectId, { name });
      setAvailableTags((prev) => [...prev, tag]);
      setSelectedTagIds((prev) => [...prev, tag.id]);
    } catch {
      toast.error('Could not create tag');
    }
  }

  function toggleDoc(docId) {
    setSelectedDocIds((prev) => (prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]));
  }

  async function save() {
    if (!title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      const { data } = await projectsApi.createTask(projectId, { title: title.trim() });
      const needsMove = (gate && gate.id) || (statusId && statusId !== firstNonDone?.id);
      if (needsMove) {
        await boardApi.updateTask(data.taskId, { gateId: gate?.id || null, statusId });
      }
      if (comment.trim() || selectedTagIds.length) {
        await boardApi.updateTask(data.taskId, {
          ...(comment.trim() ? { comment: comment.trim() } : {}),
          ...(selectedTagIds.length ? { addTagIds: selectedTagIds } : {})
        });
      }
      if (selectedDocIds.length) {
        await Promise.all(selectedDocIds.map((docId) => taskDocLinksApi.add(projectId, data.taskId, docId)));
      }
      toast.success(`Task added${gate ? ` to ${gate.name}` : ''}`);
      onCreated();
    } catch {
      toast.error('Could not add task');
      setSaving(false);
    }
  }

  const selectedTags = availableTags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <Modal
      title={gate ? `Add task to ${gate.name}` : 'Add task (Unscheduled)'}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Adding…' : 'Add task'}</button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Title</label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Status</label>
          <select className="field" value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <button className="btn-ghost" onClick={() => setDetailsOpen((v) => !v)}>
          {detailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Add details (comment, tags, docs)
        </button>

        {detailsOpen && (
          <div className="space-y-3 border-t border-border pt-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Comment</label>
              <textarea className="field min-h-16" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Tags</label>
              <TagMultiSelect
                selectedTags={selectedTags}
                availableTags={availableTags}
                onAdd={(tagId) => setSelectedTagIds((prev) => [...prev, tagId])}
                onRemove={removeTag}
                onCreate={createAndAddTag}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Linked docs</label>
              {availableDocs === null && <p className="text-sm text-muted">Loading docs...</p>}
              {availableDocs !== null && !availableDocs.length && <p className="text-sm text-muted">No docs in this project yet.</p>}
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {(availableDocs || []).map((doc) => (
                  <label key={doc.id} className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={() => toggleDoc(doc.id)} />
                    <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
