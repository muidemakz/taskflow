import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { annotationsApi } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';

function formatTimestamp(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Grouped by heading id ("anchor"), same ids the TOC and rendered body
// share. Notes whose anchor no longer matches any current heading (the doc
// was edited and that heading removed/renamed) fall into an "Other notes"
// group with no Add-note affordance, since there's no live section to
// anchor a new one to.
export default function MarginNotesRail({ projectId, docId, headings, annotations, activeId, onChange }) {
  const { user } = useAuthStore();
  const [addingFor, setAddingFor] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const headingIds = new Set(headings.map((h) => h.id));
  const orphaned = annotations.filter((a) => !headingIds.has(a.anchor));

  async function saveNote(anchor) {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await annotationsApi.create(projectId, docId, { anchor, body: draft.trim() });
      setDraft('');
      setAddingFor(null);
      onChange();
    } catch {
      toast.error('Could not add note');
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(annotationId) {
    try {
      await annotationsApi.remove(projectId, docId, annotationId);
      onChange();
    } catch {
      toast.error('Could not delete note');
    }
  }

  function renderGroup(anchor, label, notes, canAdd) {
    return (
      <div
        key={anchor}
        id={`notes-${anchor}`}
        className={`rounded-md border p-3 ${activeId === anchor ? 'border-primary bg-blue-50/40' : 'border-border'}`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{label}</h4>
          {canAdd && (
            <button className="btn-icon h-6 w-6 shrink-0" onClick={() => { setAddingFor(anchor); setDraft(''); }} aria-label="Add note">
              <Plus size={13} />
            </button>
          )}
        </div>
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-md bg-white p-2 text-sm shadow-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-[10px] font-bold text-primary">
                    {note.author?.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                  {note.author?.name}
                </span>
                {note.authorId === user?.id && (
                  <button className="text-muted hover:text-red-600" onClick={() => removeNote(note.id)} aria-label="Delete note">
                    <X size={13} />
                  </button>
                )}
              </div>
              <p className="text-muted">{note.body}</p>
              <p className="mt-1 text-[11px] text-muted">{formatTimestamp(note.createdAt)}</p>
            </div>
          ))}
          {notes.length === 0 && addingFor !== anchor && <p className="text-xs text-muted">No notes yet.</p>}
          {addingFor === anchor && (
            <div className="space-y-2">
              <textarea
                className="field min-h-16 text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a note..."
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setAddingFor(null)}>Cancel</button>
                <button className="btn-primary" onClick={() => saveNote(anchor)} disabled={saving}>Save</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Margin notes</h3>
      {headings.map((h) => renderGroup(h.id, h.text, annotations.filter((a) => a.anchor === h.id), true))}
      {orphaned.length > 0 && renderGroup('__orphaned__', 'Other notes', orphaned, false)}
      {!headings.length && !orphaned.length && (
        <p className="text-sm text-muted">No sections yet -- add headings to your doc to anchor notes.</p>
      )}
    </div>
  );
}
