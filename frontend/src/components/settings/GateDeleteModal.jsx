import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { gatesApi } from '../../api/endpoints';

const MODES = [
  { value: 'reassign', label: 'Move its tasks to another gate' },
  { value: 'create-and-move', label: 'Create a new gate and move tasks there' },
  { value: 'unschedule', label: 'Send its tasks to Unscheduled' }
];

export default function GateDeleteModal({ gate, otherGates, onClose, onDone }) {
  const [mode, setMode] = useState('unschedule');
  const [targetGateId, setTargetGateId] = useState(otherGates[0]?.id || '');
  const [newGateName, setNewGateName] = useState(`${gate.name} (new)`);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (mode === 'reassign' && !targetGateId) return toast.error('Choose a target gate');
    if (mode === 'create-and-move' && !newGateName.trim()) return toast.error('Name the new gate');
    setLoading(true);
    try {
      const body = { mode };
      if (mode === 'reassign') body.targetGateId = targetGateId;
      if (mode === 'create-and-move') body.newGateName = newGateName.trim();
      const { data } = await gatesApi.remove(gate.id, body);
      toast.success(`"${gate.name}" deleted. ${data.movedTaskCount} task(s) moved. Restore it from Trash within 30 days.`);
      onDone();
    } catch {
      toast.error('Could not delete gate');
      setLoading(false);
    }
  }

  return (
    <Modal title={`Delete "${gate.name}"`} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">Choose what happens to its tasks:</p>
      <div className="space-y-2">
        {MODES.map((m) => (
          <label key={m.value} className={`flex items-center gap-2 rounded-md border p-2 text-sm ${mode === m.value ? 'border-primary bg-blue-50' : 'border-border'}`}>
            <input type="radio" name="delete-mode" checked={mode === m.value} onChange={() => setMode(m.value)} disabled={m.value === 'reassign' && !otherGates.length} />
            {m.label}
          </label>
        ))}
      </div>

      {mode === 'reassign' && (
        <select className="field mt-3" value={targetGateId} onChange={(e) => setTargetGateId(e.target.value)}>
          {otherGates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
      {mode === 'create-and-move' && (
        <input className="field mt-3" value={newGateName} onChange={(e) => setNewGateName(e.target.value)} placeholder="New gate name" />
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="btn-primary bg-red-600 hover:bg-red-700" onClick={confirm} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete gate'}
        </button>
      </div>
    </Modal>
  );
}
