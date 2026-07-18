import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

// Shared filter bar shell used across My Tasks, Board, Docs. Options and filter
// logic are passed by parent; this component handles layout, collapsible drawer,
// search persistence, active count, and clear-all. Consistent everywhere.
export default function SharedFilterBar({
  filters,
  onChange,
  options,
  filterFields,
  onClear,
  placeholder = 'Search...',
  showSearch = true,
  searchKey = 'search'
}) {
  const [open, setOpen] = useState(false);

  // Count active filters based on provided fields
  const activeCount = filterFields.reduce((count, field) => {
    const value = filters[field.key];
    if (Array.isArray(value)) return count + (value.length > 0 ? 1 : 0);
    if (typeof value === 'boolean') return count + (value ? 1 : 0);
    if (typeof value === 'string') return count + (value.trim() !== '' ? 1 : 0);
    return count;
  }, 0);

  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <div className="card mt-3 p-2 dark:bg-slate-800">
      <div className="flex items-center gap-2">
        {showSearch && (
          <div className="relative min-w-0 flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="field pl-8 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
              placeholder={placeholder}
              value={filters[searchKey] || ''}
              onChange={(e) => set({ [searchKey]: e.target.value })}
            />
          </div>
        )}

        <button
          className={`btn-ghost shrink-0 ${activeCount ? 'border-primary text-primary' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <SlidersHorizontal size={15} /> Filters{activeCount ? ` (${activeCount})` : ''}
        </button>

        {activeCount > 0 && (
          <button className="btn-ghost shrink-0" onClick={onClear} aria-label="Clear all filters">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filterFields.map((field) => (
            <div key={field.key}>
              {field.render(filters, set)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
