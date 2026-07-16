import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { docCategoriesApi } from '../../api/endpoints';

const MODES = [
  { value: 'reassign', label: 'Move its docs to another category' },
  { value: 'create-and-move', label: 'Create a new category and move docs there' },
  { value: 'uncategorize', label: 'Leave its docs uncategorized' }
];

export default function CategoryDeleteModal({ projectId, category, affectedDocs, otherCategories, onClose, onDone }) {
  const [mode, setMode] = useState('uncategorize');
  const [targetCategoryId, setTargetCategoryId] = useState(otherCategories[0]?.id || '');
  const [newCategoryName, setNewCategoryName] = useState(`${category.name} (new)`);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (mode === 'reassign' && !targetCategoryId) return toast.error('Choose a target category');
    if (mode === 'create-and-move' && !newCategoryName.trim()) return toast.error('Name the new category');
    setLoading(true);
    try {
      const body = { mode };
      if (mode === 'reassign') body.targetCategoryId = targetCategoryId;
      if (mode === 'create-and-move') body.newCategoryName = newCategoryName.trim();
      const { data } = await docCategoriesApi.remove(projectId, category.id, body);
      toast.success(`"${category.name}" deleted. ${data.movedCount} doc(s) moved.`);
      onDone();
    } catch {
      toast.error('Could not delete category');
      setLoading(false);
    }
  }

  return (
    <Modal title={`Delete "${category.name}"`} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">
        {affectedDocs.length} doc{affectedDocs.length === 1 ? '' : 's'} in this category. Choose what happens to {affectedDocs.length === 1 ? 'it' : 'them'}:
      </p>
      <div className="space-y-2">
        {MODES.map((m) => (
          <label key={m.value} className={`flex items-center gap-2 rounded-md border p-2 text-sm ${mode === m.value ? 'border-primary bg-blue-50' : 'border-border'}`}>
            <input
              type="radio"
              name="delete-mode"
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              disabled={m.value === 'reassign' && !otherCategories.length}
            />
            {m.label}
          </label>
        ))}
      </div>

      {mode === 'reassign' && (
        <select className="field mt-3" value={targetCategoryId} onChange={(e) => setTargetCategoryId(e.target.value)}>
          {otherCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {mode === 'create-and-move' && (
        <input className="field mt-3" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category name" />
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="btn-primary bg-red-600 hover:bg-red-700" onClick={confirm} disabled={loading}>
          {loading ? 'Deleting…' : 'Delete category'}
        </button>
      </div>
    </Modal>
  );
}
