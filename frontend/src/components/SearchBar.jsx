import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import InlineTaskModal from './board/InlineTaskModal';
import { searchApi } from '../api/endpoints';

export default function SearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openTask, setOpenTask] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchApi.query(q).then(({ data }) => setResults(data.results)).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function reset() {
    setOpen(false);
    setQuery('');
    setResults(null);
  }

  // Opens the task right here instead of navigating to its board -- the
  // dropdown closes and the query clears, but the page underneath stays put.
  function goToTask(task) {
    reset();
    setOpenTask({ taskId: task.id, projectId: task.projectId });
  }

  function goToProject(project) {
    reset();
    navigate(`/projects/${project.id}`);
  }

  const hasResults = Boolean(results && (results.tasks.length || results.projects.length || results.docs.length));

  return (
    <div className="relative w-full max-w-xs" ref={containerRef}>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="field pl-8 pr-7"
          placeholder="Search tasks and projects..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur(); } }}
        />
        {query && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-text" onClick={reset} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-96 overflow-y-auto rounded-md border border-border bg-white shadow-lg">
          {loading && <div className="p-3 text-sm text-muted">Searching...</div>}
          {!loading && !hasResults && <div className="p-3 text-sm text-muted">No results for &quot;{query}&quot;</div>}

          {!loading && results?.tasks.length > 0 && (
            <div className="border-b border-slate-100 py-1">
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">Tasks</div>
              {results.tasks.map((task) => (
                <button key={task.id} className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => goToTask(task)}>
                  <span className="font-medium">
                    {task.customId && <span className="id-badge mr-1.5 align-middle" title={`TID ${task.customId}`} aria-label={`TID ${task.customId}`}>{task.customId}</span>}
                    {task.title}
                  </span>
                  <span className="text-xs text-muted">{task.projectTitle}{task.gateName ? ` · ${task.gateName}` : ''}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && results?.projects.length > 0 && (
            <div className="border-b border-slate-100 py-1">
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">Projects</div>
              {results.projects.map((project) => (
                <button key={project.id} className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => goToProject(project)}>
                  {project.title}
                </button>
              ))}
            </div>
          )}

          {!loading && results?.docs.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">Docs</div>
              {results.docs.map((doc) => (
                <div key={doc.id} className="px-3 py-2 text-sm">{doc.title}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {openTask && (
        <InlineTaskModal projectId={openTask.projectId} taskId={openTask.taskId} onClose={() => setOpenTask(null)} />
      )}
    </div>
  );
}
