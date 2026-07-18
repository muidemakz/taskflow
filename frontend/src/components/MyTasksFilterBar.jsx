import { AlertTriangle, Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import TagMultiSelect from './TagMultiSelect';

export const EMPTY_MY_TASK_FILTERS = {
  projectId: '',
  tagIds: [],
  priority: '',
  statusId: '',
  gateId: '',
  blockedOnly: false,
  dueFrom: '',
  dueTo: '',
  search: ''
};

export function countActiveMyTaskFilters(f) {
  let n = 0;
  if (f.projectId) n += 1;
  if (f.tagIds.length) n += 1;
  if (f.priority) n += 1;
  if (f.statusId) n += 1;
  if (f.gateId) n += 1;
  if (f.blockedOnly) n += 1;
  if (f.dueFrom || f.dueTo) n += 1;
  if (f.search.trim()) n += 1;
  return n;
}

// Full My Tasks filter bar: an always-visible search box plus a collapsible
// panel of dropdowns/toggles. On narrow screens the panel grid stacks to one
// column, so it behaves like a drawer that opens beneath the search row. All
// dimensions AND together (see applyMyTaskFilters in MyTasks).
export default function MyTasksFilterBar({ filters, onChange, options, onClear }) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveMyTaskFilters(filters);
  const selectedTags = options.tags.filter((t) => filters.tagIds.includes(t.id));

  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <div className="card mt-3 p-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="field pl-8"
            placeholder="Search title or ID..."
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
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
          <select className="field" value={filters.projectId} onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">Any project</option>
            {options.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          <select className="field" value={filters.statusId} onChange={(e) => set({ statusId: e.target.value })}>
            <option value="">Any status</option>
            {options.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select className="field" value={filters.priority} onChange={(e) => set({ priority: e.target.value })}>
            <option value="">Any priority</option>
            <option value="HIGH">High</option>
            <option value="MID">Mid</option>
            <option value="LOW">Low</option>
            <option value="NONE">None</option>
          </select>

          <select className="field" value={filters.gateId} onChange={(e) => set({ gateId: e.target.value })}>
            <option value="">Any gate</option>
            {options.hasUnscheduled && <option value="__none__">Unscheduled</option>}
            {options.gates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <div className="flex items-center gap-2 rounded-md border border-border bg-white px-2 dark:bg-slate-800">
            <span className="text-sm text-muted">Due</span>
            <input type="date" className="field border-0 px-1" value={filters.dueFrom} onChange={(e) => set({ dueFrom: e.target.value })} aria-label="Due from" />
            <span className="text-muted">–</span>
            <input type="date" className="field border-0 px-1" value={filters.dueTo} onChange={(e) => set({ dueTo: e.target.value })} aria-label="Due to" />
          </div>

          <button
            className={`btn-ghost justify-start ${filters.blockedOnly ? 'border-red-200 bg-red-50 text-red-700' : ''}`}
            onClick={() => set({ blockedOnly: !filters.blockedOnly })}
          >
            <AlertTriangle size={14} /> Blocked only
          </button>

          <div className="sm:col-span-2 lg:col-span-3">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold ${selectedTags.length ? 'text-primary' : 'text-muted'}`}>
                Tags{selectedTags.length ? ` (${selectedTags.length})` : ''}
              </span>
              <TagMultiSelect
                selectedTags={selectedTags}
                availableTags={options.tags}
                onAdd={(tagId) => set({ tagIds: [...filters.tagIds, tagId] })}
                onRemove={(tagId) => set({ tagIds: filters.tagIds.filter((tid) => tid !== tagId) })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
