import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import GateDeleteModal from './GateDeleteModal';
import { gatesApi } from '../../api/endpoints';

export default function GateSettingsList({ gates, projectId, onChange }) {
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState(null);
  const sorted = [...gates].sort((a, b) => a.order - b.order);

  async function rename(gate, name) {
    if (!name.trim() || name === gate.name) return;
    await gatesApi.update(gate.id, { name: name.trim() });
    onChange();
  }

  async function move(index, direction) {
    const target = sorted[index + direction];
    if (!target) return;
    const current = sorted[index];
    await Promise.all([
      gatesApi.update(current.id, { order: target.order }),
      gatesApi.update(target.id, { order: current.order })
    ]);
    onChange();
  }

  async function addGate() {
    if (!newName.trim()) return;
    try {
      await gatesApi.create(projectId, { name: newName.trim() });
      setNewName('');
      onChange();
    } catch {
      toast.error('Could not add gate');
    }
  }

  return (
    <div className="card divide-y divide-slate-100">
      {sorted.map((gate, index) => (
        <div key={gate.id} className="flex items-center gap-2 p-3">
          <button className="shrink-0 text-muted disabled:opacity-30" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
            <ArrowUp size={15} />
          </button>
          <button className="shrink-0 text-muted disabled:opacity-30" onClick={() => move(index, 1)} disabled={index === sorted.length - 1} aria-label="Move down">
            <ArrowDown size={15} />
          </button>
          <input className="field flex-1 border-transparent px-2 py-1" defaultValue={gate.name} onBlur={(e) => rename(gate, e.target.value)} />
          <button className="btn-icon text-red-700 hover:bg-red-50" onClick={() => setDeleting(gate)} aria-label="Delete gate">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {!sorted.length && <p className="p-3 text-sm text-muted">No gates yet -- add one to start a roadmap.</p>}
      <div className="flex items-center gap-2 p-3">
        <input
          className="field flex-1"
          placeholder="New gate name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addGate()}
        />
        <button className="btn-primary" onClick={addGate}><Plus size={15} /> Add</button>
      </div>

      {deleting && (
        <GateDeleteModal
          gate={deleting}
          otherGates={sorted.filter((g) => g.id !== deleting.id)}
          onClose={() => setDeleting(null)}
          onDone={() => { setDeleting(null); onChange(); }}
        />
      )}
    </div>
  );
}
