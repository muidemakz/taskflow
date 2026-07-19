import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi, trashApi } from '../api/endpoints';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import Breadcrumb from '../components/Breadcrumb';

const TYPE_LABELS = { project: 'Project', task: 'Task', group: 'Group', gate: 'Gate', tag: 'Tag', doc: 'Doc', category: 'Category', notechat: 'Note' };

function daysRemaining(deletedAt, retentionDays) {
  const elapsedDays = Math.floor((Date.now() - new Date(deletedAt).getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, retentionDays - elapsedDays);
}

// Global, not per-project: a deleted Project itself isn't reachable from
// within any project view. Reached from Account (a "Trash" chevron row that
// navigates here rather than opening a modal -- this used to be a modal, but
// a list this size deserved its own page with room for search), with a back
// button returning there rather than relying on browser back, matching the
// Breadcrumb pattern every other detail page in the app already uses.
export default function Trash() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [retentionDays, setRetentionDays] = useState(30);
  const [projectTitles, setProjectTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

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

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.title.toLowerCase().includes(q));
  }, [items, search]);

  if (loading) return <main className="page-container py-6 text-center text-muted">Loading trash...</main>;

  return (
    <main className="page-container py-6">
      <Breadcrumb
        items={[{ label: 'Account', to: '/account' }, { label: 'Trash' }]}
        onBack={() => navigate('/account')}
      />

      <div className="mb-5">
        <h1 className="text-xl font-bold">Trash</h1>
        <p className="text-sm text-muted">Items are permanently deleted {retentionDays} days after being trashed</p>
      </div>

      {items.length > 0 && (
        <div className="card mb-3 p-2 dark:bg-slate-800">
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-8 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
              placeholder="Search trash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="btn-icon absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {!items.length ? (
        <div className="card p-10 text-center text-muted">
          <Trash2 size={28} className="mx-auto mb-3 text-slate-300" />
          Nothing in trash.
        </div>
      ) : !visibleItems.length ? (
        <div className="card p-10 text-center text-muted">
          No trashed items match "{search}".
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-700">
          {visibleItems.map((item) => {
            const remaining = daysRemaining(item.deletedAt, retentionDays);
            const projectTitle = item.type === 'project' ? item.title : projectTitles[item.projectId];
            return (
              <div key={`${item.type}-${item.id}`} className="flex flex-wrap items-center gap-3 p-3">
                <span className="chip bg-slate-100 text-muted">{TYPE_LABELS[item.type] || item.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.customId && <span className="id-badge mr-1.5 align-middle" title={`TID ${item.customId}`} aria-label={`TID ${item.customId}`}>{item.customId}</span>}
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
