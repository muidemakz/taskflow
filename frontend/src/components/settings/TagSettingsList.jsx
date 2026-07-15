import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DeleteConfirmModal from '../DeleteConfirmModal';
import { tagsApi } from '../../api/endpoints';
import { tagColorClass } from '../../utils/board';

export default function TagSettingsList({ tags, onChange }) {
  const [deleting, setDeleting] = useState(null);

  async function confirmDelete() {
    try {
      await tagsApi.remove(deleting.id);
      toast.success(`"${deleting.name}" deleted.`);
      setDeleting(null);
      onChange();
    } catch {
      toast.error('Could not delete tag');
      setDeleting(null);
    }
  }

  if (!tags.length) return <p className="card p-3 text-sm text-muted">No tags yet -- add one from a task's tag selector.</p>;

  return (
    <div className="card divide-y divide-slate-100">
      {tags.map((tag) => (
        <div key={tag.id} className="flex items-center justify-between gap-2 p-3">
          <span className={`chip ${tagColorClass(tag.id)}`}>{tag.name}</span>
          <button className="btn-icon text-red-700 hover:bg-red-50" onClick={() => setDeleting(tag)} aria-label="Delete tag">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {deleting && (
        <DeleteConfirmModal
          title={`Delete "${deleting.name}"?`}
          warning="This removes the tag from every task it's attached to. The tag can be restored from Trash within 30 days."
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
