import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus, StickyNote, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { notesApi } from '../api/endpoints';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

// "Untitled N" is never stored -- it's a display-only number derived from
// creation order (oldest = 1), independent of the list's own sort order
// (newest-first, per spec), so renaming/reordering never has to reconcile
// against a placeholder that was written to the DB.
function withDisplayNumbers(chats) {
  const byCreatedAsc = [...chats].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const numberById = new Map(byCreatedAsc.map((c, i) => [c.id, i + 1]));
  return chats.map((c) => ({ ...c, displayTitle: c.title || `Untitled ${numberById.get(c.id)}` }));
}

export default function Notes() {
  const navigate = useNavigate();
  const [chats, setChats] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    notesApi.list().then(({ data }) => setChats(data));
  }

  useEffect(() => { load(); }, []);

  async function createChat() {
    setCreating(true);
    try {
      const { data } = await notesApi.create();
      navigate(`/notes/${data.id}`);
    } catch {
      toast.error('Could not create chat');
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await notesApi.remove(deleteTarget.id);
      toast.success('Chat deleted');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Could not delete chat');
    } finally {
      setDeleting(false);
    }
  }

  if (chats === null) return <main className="page-container py-6 text-center text-muted">Loading notes...</main>;

  const numbered = withDisplayNumbers(chats);

  return (
    <main className="page-container py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Notes</h1>
        <button className="btn-primary" onClick={createChat} disabled={creating}>
          <MessageSquarePlus size={16} /> New chat
        </button>
      </div>

      {!numbered.length ? (
        <div className="card p-10 text-center text-muted">
          <StickyNote size={28} className="mx-auto mb-3 text-slate-300" />
          No notes yet.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-700">
          {numbered.map((chat) => (
            <div key={chat.id} className="flex items-center gap-3 p-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => navigate(`/notes/${chat.id}`)}
              >
                <p className="truncate text-sm font-medium">{chat.displayTitle}</p>
                <p className="text-xs text-muted">
                  {chat.aiEnabled ? 'Talk to AI on · ' : ''}
                  Updated {new Date(chat.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              </button>
              <button
                className="btn-icon shrink-0 text-red-600"
                onClick={() => setDeleteTarget(chat)}
                aria-label={`Delete "${chat.displayTitle}"`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title={`Delete "${deleteTarget.title || 'this chat'}"?`}
          warning="This chat and all its messages will be removed."
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}
