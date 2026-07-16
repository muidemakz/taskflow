import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import CategoryDeleteModal from './CategoryDeleteModal';
import { docCategoriesApi } from '../../api/endpoints';

export default function DocCategorySettingsList({ projectId, categories, onChange }) {
  const [newName, setNewName] = useState('');
  const [resolving, setResolving] = useState(null);

  async function rename(category, name) {
    if (!name.trim() || name === category.name) return;
    try {
      await docCategoriesApi.rename(category.id, name.trim());
      onChange();
    } catch {
      toast.error('Could not rename category');
    }
  }

  async function addCategory() {
    if (!newName.trim()) return;
    try {
      await docCategoriesApi.create(projectId, { name: newName.trim() });
      setNewName('');
      onChange();
    } catch {
      toast.error('Could not add category');
    }
  }

  // First call carries no mode -- if the category has no docs, the backend
  // deletes it immediately and this resolves without ever opening a modal;
  // if it does, the backend returns a preview (no delete yet) and we show
  // the three-path prompt with exactly those affected docs.
  async function requestDelete(category) {
    try {
      const { data } = await docCategoriesApi.remove(projectId, category.id, {});
      if (data.needsResolution) {
        setResolving({ category, affectedDocs: data.affectedDocs });
      } else {
        toast.success(`"${category.name}" deleted`);
        onChange();
      }
    } catch {
      toast.error('Could not delete category');
    }
  }

  return (
    <div className="card divide-y divide-slate-100">
      {categories.map((category) => (
        <div key={category.id} className="flex items-center gap-2 p-3">
          <input
            className="field flex-1 border-transparent px-2 py-1"
            defaultValue={category.name}
            onBlur={(e) => rename(category, e.target.value)}
          />
          <button className="btn-icon text-red-700 hover:bg-red-50" onClick={() => requestDelete(category)} aria-label="Delete category">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {!categories.length && <p className="p-3 text-sm text-muted">No categories yet.</p>}
      <div className="flex items-center gap-2 p-3">
        <input
          className="field flex-1"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
        />
        <button className="btn-primary" onClick={addCategory}><Plus size={15} /> Add</button>
      </div>

      {resolving && (
        <CategoryDeleteModal
          projectId={projectId}
          category={resolving.category}
          affectedDocs={resolving.affectedDocs}
          otherCategories={categories.filter((c) => c.id !== resolving.category.id)}
          onClose={() => setResolving(null)}
          onDone={() => { setResolving(null); onChange(); }}
        />
      )}
    </div>
  );
}
