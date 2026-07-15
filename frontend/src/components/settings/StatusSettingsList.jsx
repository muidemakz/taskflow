import { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DeleteConfirmModal from '../DeleteConfirmModal';
import { statusesApi } from '../../api/endpoints';

export default function StatusSettingsList({ statuses, onChange }) {
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState(null);
  const sorted = [...statuses].sort((a, b) => a.order - b.order);

  async function rename(status, name) {
    if (!name.trim() || name === status.name) return;
    await statusesApi.update(status.id, { name: name.trim() });
    onChange();
  }

  // Radio semantics, not a checkbox: exactly one status is ever
  // countsAsDone, so the UI only offers "make this the Done status."
  async function setDone(status) {
    if (status.countsAsDone) return;
    try {
      await statusesApi.update(status.id, { countsAsDone: true });
      onChange();
    } catch {
      toast.error('Could not update');
    }
  }

  async function move(index, direction) {
    const target = sorted[index + direction];
    if (!target) return;
    const current = sorted[index];
    await Promise.all([
      statusesApi.update(current.id, { order: target.order }),
      statusesApi.update(target.id, { order: current.order })
    ]);
    onChange();
  }

  async function addStatus() {
    if (!newName.trim()) return;
    try {
      await statusesApi.create(sorted[0]?.projectId, { name: newName.trim() });
      setNewName('');
      onChange();
    } catch {
      toast.error('Could not add status');
    }
  }

  async function confirmDelete() {
    try {
      await statusesApi.remove(deleting.id);
      toast.success(`"${deleting.name}" deleted.`);
      setDeleting(null);
      onChange();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not delete status');
      setDeleting(null);
    }
  }

  return (
    <div className="card divide-y divide-slate-100">
      {sorted.map((status, index) => (
        <div key={status.id} className="flex items-center gap-2 p-3">
          <button
            className="shrink-0 text-muted disabled:opacity-30"
            onClick={() => move(index, -1)}
            disabled={index === 0}
            aria-label="Move up"
          >
            <ArrowUp size={15} />
          </button>
          <button
            className="shrink-0 text-muted disabled:opacity-30"
            onClick={() => move(index, 1)}
            disabled={index === sorted.length - 1}
            aria-label="Move down"
          >
            <ArrowDown size={15} />
          </button>
          <input
            className="field flex-1 border-transparent px-2 py-1"
            defaultValue={status.name}
            onBlur={(e) => rename(status, e.target.value)}
          />
          <button
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${status.countsAsDone ? 'bg-emerald-50 text-success' : 'text-muted hover:bg-slate-50'}`}
            onClick={() => setDone(status)}
            title="Counts as done"
          >
            {status.countsAsDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            Done status
          </button>
          <button className="btn-icon text-red-700 hover:bg-red-50" onClick={() => setDeleting(status)} aria-label="Delete status">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 p-3">
        <input
          className="field flex-1"
          placeholder="New status name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addStatus()}
        />
        <button className="btn-primary" onClick={addStatus}><Plus size={15} /> Add</button>
      </div>

      {deleting && (
        <DeleteConfirmModal
          title={`Delete "${deleting.name}"?`}
          warning="Tasks currently in this status can't be moved automatically -- if any tasks still use it, deletion will be blocked until they're moved."
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
