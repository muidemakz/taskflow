import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { projectsApi, boardApi } from '../../api/endpoints';

// Creates via the legacy create-task endpoint (lands in the project's first
// non-done status, Unscheduled) then immediately moves it via the board
// endpoint if a different gate/status was chosen -- reuses that endpoint's
// validation, activity logging, and position handling instead of
// duplicating them in a dedicated create-in-gate endpoint. gate === null
// means Unscheduled (status only, no gate move needed).
export default function QuickAddTaskModal({ projectId, gate, statuses, onClose, onCreated }) {
  const firstNonDone = statuses.find((s) => !s.countsAsDone) || statuses[0];
  const [title, setTitle] = useState('');
  const [statusId, setStatusId] = useState(firstNonDone?.id || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      const { data } = await projectsApi.createTask(projectId, { title: title.trim() });
      const needsMove = (gate && gate.id) || (statusId && statusId !== firstNonDone?.id);
      if (needsMove) {
        await boardApi.updateTask(data.taskId, { gateId: gate?.id || null, statusId });
      }
      toast.success(`Task added${gate ? ` to ${gate.name}` : ''}`);
      onCreated();
    } catch {
      toast.error('Could not add task');
      setSaving(false);
    }
  }

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
      </div>
    </Modal>
  );
}
