import { useState } from 'react';
import { ChevronDown, Clock, Layers, Plus, Settings, Share2, Tag } from 'lucide-react';
import ProgressBar from './ProgressBar';

const COLLAPSE_KEY = 'taskflow_project_card_collapsed';

function readCollapsed(projectId) {
  try {
    return Boolean(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}')[projectId]);
  } catch {
    return false;
  }
}

function writeCollapsed(projectId, collapsed) {
  let map = {};
  try {
    map = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
  } catch {
    map = {};
  }
  map[projectId] = collapsed;
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map));
}

function formatActivity(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Clean project detail card in the ShareView mould: title, description,
// progress, a metadata row, and quick actions. A chevron collapses it to a
// compact single line (title + mini progress) that tucks away on scroll;
// the collapsed state persists per project in localStorage. The body uses
// the grid-rows 0fr/1fr trick for a smooth height transition without a
// hard-coded max-height.
export default function ProjectDetailCard({ project, stats, tagCount = 0, onShare, onSettings, onAddTask }) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(project.id));

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(project.id, next);
      return next;
    });
  }

  const pct = stats?.pct ?? 0;
  const done = stats?.done ?? 0;
  const total = stats?.total ?? 0;
  const gateCount = project.metrics?.gateCount ?? 0;
  const lastActivity = formatActivity(project.updatedAt);

  return (
    <section className="card mb-5 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <button
          className="btn-icon h-8 w-8 shrink-0"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand project details' : 'Collapse project details'}
        >
          <ChevronDown size={16} className={`transition-transform duration-300 ${collapsed ? '-rotate-90' : ''}`} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{project.title}</h1>
        {collapsed && (
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden w-24 sm:block"><ProgressBar value={pct} /></div>
            <span className="text-sm font-semibold text-primary">{pct}%</span>
          </div>
        )}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            {project.description && <p className="text-muted">{project.description}</p>}

            <div className="mt-4">
              <ProgressBar value={pct} />
              <p className="mt-2 text-sm text-muted">{done} of {total} done · {pct}%</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><Layers size={14} /> {gateCount} {gateCount === 1 ? 'gate' : 'gates'}</span>
              <span className="inline-flex items-center gap-1.5"><Tag size={14} /> {tagCount} {tagCount === 1 ? 'tag' : 'tags'}</span>
              {lastActivity && <span className="inline-flex items-center gap-1.5"><Clock size={14} /> Updated {lastActivity}</span>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {onShare && <button className="btn-ghost" onClick={onShare}><Share2 size={15} /> Share</button>}
              {onSettings && <button className="btn-ghost" onClick={onSettings}><Settings size={15} /> Settings</button>}
              {onAddTask && <button className="btn-primary" onClick={onAddTask}><Plus size={15} /> Add task</button>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
