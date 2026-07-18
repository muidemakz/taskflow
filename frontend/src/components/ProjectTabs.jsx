import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

// Two modes: pass onSelectTab for a page that hosts both tabs itself (state
// swap, no route change, no remount) -- the unified project workspace uses
// this. Omit onSelectTab for a page that only ever shows one tab and needs
// the other to navigate elsewhere (e.g. the legacy checklist view) -- that
// mode falls back to real links.
//
// boardMode/onToggleBoardView cover the Tasks tab's own sub-view (gates
// grid vs. whole-project board): when provided, the button becomes a
// toggle whose label reflects whichever view is NOT currently showing,
// instead of a one-way link to a separate page. Omit both for the legacy
// checklist view, which still just wants a plain link to the board.
export default function ProjectTabs({ projectId, active, tasksTo, docsTo, onSelectTab, onNewEntry, boardMode, onToggleBoardView }) {
  const navigate = useNavigate();
  const resolvedDocsTo = docsTo || `/projects/${projectId}/roadmap?tab=docs`;

  function TabButton({ tabKey, to, children }) {
    const className = `rounded-md px-3 py-1.5 text-sm font-semibold transition ${active === tabKey ? 'bg-primary text-white' : 'text-muted hover:bg-slate-50'}`;
    if (onSelectTab) return <button className={className} onClick={() => onSelectTab(tabKey)}>{children}</button>;
    return <Link to={to} className={className}>{children}</Link>;
  }

  return (
    <div className="border-b border-border bg-white px-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-1 pb-2 pt-1">
        <div className="flex gap-1">
          <TabButton tabKey="tasks" to={tasksTo || `/projects/${projectId}`}>Tasks</TabButton>
          <TabButton tabKey="docs" to={resolvedDocsTo}>Docs</TabButton>
        </div>
        {active === 'tasks' && onToggleBoardView && (
          <button className="btn-ghost" onClick={onToggleBoardView}>
            {boardMode === 'board' ? 'Roadmap view' : 'Whole-project board'}
          </button>
        )}
        {active === 'tasks' && !onToggleBoardView && (
          <button className="btn-ghost" onClick={() => navigate(`/projects/${projectId}/board`)}>
            Whole-project board
          </button>
        )}
        {active === 'docs' && onNewEntry && (
          <button className="btn-primary" onClick={onNewEntry}>
            <Plus size={15} /> New entry
          </button>
        )}
      </div>
    </div>
  );
}
