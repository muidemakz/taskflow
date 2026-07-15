import { LayoutGrid, List } from 'lucide-react';
import { SORT_OPTIONS } from '../../utils/board';

export default function BoardToolbar({ view, onViewChange, sortKey, onSortChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-[#d8e0ea] bg-white p-1">
        <button
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition ${view === 'board' ? 'bg-primary text-white' : 'text-muted'}`}
          onClick={() => onViewChange('board')}
        >
          <LayoutGrid size={15} /> Board
        </button>
        <button
          className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold transition ${view === 'list' ? 'bg-primary text-white' : 'text-muted'}`}
          onClick={() => onViewChange('list')}
        >
          <List size={15} /> List
        </button>
      </div>
      <select className="field w-auto" value={sortKey} onChange={(e) => onSortChange(e.target.value)}>
        <option value="default">Manual order</option>
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
