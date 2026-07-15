import { AlertTriangle, Star, X } from 'lucide-react';
import TagMultiSelect from '../TagMultiSelect';
import { hasActiveFilters } from '../../utils/board';

export default function BoardFilterBar({ filters, onChange, availableTags }) {
  const selectedTags = availableTags.filter((t) => filters.tagIds.includes(t.id));

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-2">
      <TagMultiSelect
        selectedTags={selectedTags}
        availableTags={availableTags}
        onAdd={(tagId) => onChange({ ...filters, tagIds: [...filters.tagIds, tagId] })}
        onRemove={(tagId) => onChange({ ...filters, tagIds: filters.tagIds.filter((id) => id !== tagId) })}
      />

      <select className="field w-auto" value={filters.priority} onChange={(e) => onChange({ ...filters, priority: e.target.value })}>
        <option value="">Any priority</option>
        <option value="HIGH">High</option>
        <option value="MID">Mid</option>
        <option value="LOW">Low</option>
        <option value="NONE">None</option>
      </select>

      <button
        className={`btn-ghost ${filters.blockedOnly ? 'border-red-200 bg-red-50 text-red-700' : ''}`}
        onClick={() => onChange({ ...filters, blockedOnly: !filters.blockedOnly })}
      >
        <AlertTriangle size={14} /> Blocked only
      </button>

      <button
        className={`btn-ghost ${filters.focusOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}`}
        onClick={() => onChange({ ...filters, focusOnly: !filters.focusOnly })}
      >
        <Star size={14} /> Focus only
      </button>

      <select className="field w-auto" value={filters.dueFilter} onChange={(e) => onChange({ ...filters, dueFilter: e.target.value })}>
        <option value="">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="thisWeek">Due this week</option>
        <option value="hasDate">Has a date</option>
        <option value="noDate">No date</option>
      </select>

      {hasActiveFilters(filters) && (
        <button className="btn-ghost ml-auto" onClick={() => onChange({ tagIds: [], priority: '', blockedOnly: false, focusOnly: false, dueFilter: '' })}>
          <X size={14} /> Clear filters
        </button>
      )}
    </div>
  );
}
