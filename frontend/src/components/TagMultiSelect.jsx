import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { tagColorClass } from '../utils/board';

// Genuinely new component -- confirmed absent from the Prompt 0 audit (no
// multi-select dropdown pattern existed anywhere in the app). Matches the
// existing field/card/chip visual language rather than inventing a new one.
export default function TagMultiSelect({ selectedTags = [], availableTags = [], onAdd, onRemove, onCreate, readOnly = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedIds = new Set(selectedTags.map((t) => t.id));
  const unselected = availableTags.filter((t) => !selectedIds.has(t.id));
  const filtered = query.trim()
    ? unselected.filter((t) => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    : unselected;
  const exactMatchExists = availableTags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  async function handleCreate() {
    const name = query.trim();
    if (!name || exactMatchExists) return;
    await onCreate?.(name);
    setQuery('');
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map((tag) => (
          <span key={tag.id} className={`chip gap-1 ${tagColorClass(tag.id)}`}>
            {tag.name}
            {!readOnly && (
              <button onClick={() => onRemove(tag.id)} aria-label={`Remove ${tag.name}`} className="ml-0.5 opacity-70 hover:opacity-100">
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {!readOnly && (
          <button className="btn-icon h-7 w-7" onClick={() => setOpen((v) => !v)} aria-label="Add tag">
            <Plus size={14} />
          </button>
        )}
      </div>

      {open && !readOnly && (
        <div className="card absolute z-20 mt-2 w-64 p-2">
          <input
            autoFocus
            className="field mb-2"
            placeholder="Search or create tag..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length === 0) handleCreate();
            }}
          />
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => { onAdd(tag.id); setQuery(''); }}
              >
                <span className={`chip ${tagColorClass(tag.id)}`}>{tag.name}</span>
              </button>
            ))}
            {!filtered.length && !query.trim() && <p className="px-2 py-1.5 text-sm text-muted">No more tags</p>}
            {onCreate && query.trim() && !exactMatchExists && (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-primary hover:bg-blue-50"
                onClick={handleCreate}
              >
                <Plus size={13} /> Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
