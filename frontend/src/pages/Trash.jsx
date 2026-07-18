import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, trashApi } from '../api/endpoints';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

const TYPE_LABELS = { project: 'Project', task: 'Task', group: 'Group', gate: 'Gate', tag: 'Tag' };

function daysRemaining(deletedAt, retentionDays) {
  const elapsedDays = Math.floor((Date.now() - new Date(deletedAt).getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, retentionDays - elapsedDays);
}

// Global, not per-project: a deleted Project itself isn't reachable from
// within any project view, and Topbar already fits a global nav pattern
// (matches the existing Admin link) better than nesting this under a
// project you'd have to already be inside.
export default function Trash() {
  const [items, setItems] = useState([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [projectTitles, setProjectTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([trashApi.list(), projectsApi.list()])
      .then(([trashRes, projectsRes]) => {
        setItems(trashRes.data.items);
        setRetentionDays(trashRes.data.retentionDays);
        setProjectTitles(Object.fromEntries(projectsRes.data.map((p) => [p.id, p.title])));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function restore(item) {
    setRestoringId(item.id);
    try {
      await trashApi.restore(item.type, item.id);
      toast.success(`"${item.title}" restored.`);
      load();
    } catch {
      toast.error('Could not restore item');
    } finally {
      setRestoringId(null);
    }
  }

  async function confirmDeleteForever() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await trashApi.remove(deleteTarget.type, deleteTarget.id);
      toast.success(`"${deleteTarget.title}" permanently deleted.`);
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Could not delete item');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <main className="p-8 text-center text-muted">Loading trash...</main>;

  return (
    <main className="page-container py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold">Trash</h1>
        <p className="text-sm text-muted">Items are permanently deleted {retentionDays} days after being trashed</p>
      </div>

      {!items.length ? (
        <div className="card p-10 text-center text-muted">
          <Trash2 size={28} className="mx-auto mb-3 text-slate-300" />
          Nothing in trash.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {items.map((item) => {
            const remaining = daysRemaining(item.deletedAt, retentionDays);
            const projectTitle = item.type === 'project' ? item.title : projectTitles[item.projectId];
            return (
              <div key={`${item.type}-${item.id}`} className="flex flex-wrap items-center gap-3 p-3">
                <span className="chip bg-slate-100 text-muted">{TYPE_LABELS[item.type] || item.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.customId && <span className="id-badge mr-1.5 align-middle">{item.customId}</span>}
                    {item.title}
                  </p>
                  <p className="text-xs text-muted">
                    {item.type !== 'project' && projectTitle ? `${projectTitle} · ` : ''}
                    Deleted {new Date(item.deletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ·{' '}
                    {remaining > 0 ? `${remaining} day${remaining === 1 ? '' : 's'} left` : 'expiring soon'}
                  </p>
                </div>
                <button className="btn-ghost" onClick={() => restore(item)} disabled={restoringId === item.id}>
                  <RotateCcw size={14} /> {restoringId === item.id ? 'Restoring…' : 'Restore'}
                </button>
                <button
                  className="btn-icon shrink-0 text-red-600"
                  onClick={() => setDeleteTarget(item)}
                  aria-label={`Permanently delete "${item.title}"`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title={`Delete "${deleteTarget.title}" forever?`}
          warning="This can't be undone -- it skips the rest of the retention window and removes it (and anything inside it) immediately."
          confirmLabel="Delete forever"
          loading={deleting}
          onConfirm={confirmDeleteForever}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}
