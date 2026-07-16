import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import KanbanBoard from '../components/board/KanbanBoard';
import ListView from '../components/board/ListView';
import BoardToolbar from '../components/board/BoardToolbar';
import BoardFilterBar from '../components/board/BoardFilterBar';
import TaskDetailModal from '../components/board/TaskDetailModal';
import ProjectSettingsModal from '../components/settings/ProjectSettingsModal';
import { useBoardStore } from '../store/boardStore';
import { projectsApi } from '../api/endpoints';
import { EMPTY_FILTERS, filterTasks } from '../utils/board';

export default function ProjectBoard() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawGateId = searchParams.get('gateId');
  const isUnscheduledView = rawGateId === 'unscheduled';
  const gateId = isUnscheduledView ? null : rawGateId;

  const loadProjectMeta = useBoardStore((s) => s.loadProjectMeta);
  const loadBoard = useBoardStore((s) => s.loadBoard);
  const columns = useBoardStore((s) => s.columns);
  const statuses = useBoardStore((s) => s.statuses);
  const gates = useBoardStore((s) => s.gates);
  const tags = useBoardStore((s) => s.tags);
  const hasRoadmap = useBoardStore((s) => s.hasRoadmap);
  const view = useBoardStore((s) => s.view);
  const sortKey = useBoardStore((s) => s.sortKey);
  const setView = useBoardStore((s) => s.setView);
  const setSortKey = useBoardStore((s) => s.setSortKey);
  const loading = useBoardStore((s) => s.loading);
  const [projectTitle, setProjectTitle] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [openTask, setOpenTask] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const highlightTaskId = searchParams.get('taskId');
  const highlightApplied = useRef(false);

  useEffect(() => {
    loadProjectMeta(id);
    projectsApi.detail(id).then(({ data }) => setProjectTitle(data.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadBoard(id, gateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, gateId]);

  // Landing here from search (?taskId=...) opens that task directly instead
  // of leaving the user to find it themselves among possibly many columns.
  useEffect(() => {
    if (!highlightTaskId || highlightApplied.current || !columns.length) return;
    const found = columns.flatMap((c) => c.tasks).find((t) => t.id === highlightTaskId);
    if (found) {
      setOpenTask(found);
      highlightApplied.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTaskId, columns]);

  const displayColumns = useMemo(() => {
    let cols = columns;
    if (isUnscheduledView) cols = cols.map((col) => ({ ...col, tasks: col.tasks.filter((t) => !t.gateId) }));
    return cols.map((col) => ({ ...col, tasks: filterTasks(col.tasks, filters) }));
  }, [columns, isUnscheduledView, filters]);

  // Gate-scoped board: columns are already filtered to that gate's tasks by
  // the backend (loadBoard(id, gateId)), so "that gate's statuses" is just
  // whichever status columns currently hold at least one of its tasks.
  // Whole-project / Unscheduled views (gateId null) get every status.
  const statusOptionsForModal = useMemo(() => {
    if (!gateId) return statuses;
    const used = columns.filter((c) => c.tasks.length).map((c) => c.status);
    return used.length ? used : statuses;
  }, [gateId, columns, statuses]);

  const currentGate = gates.find((g) => g.id === gateId);
  const workflowContext = useMemo(
    () => ({
      gateOrderById: Object.fromEntries(gates.map((g) => [g.id, g.order])),
      statusOrderById: Object.fromEntries(statuses.map((s) => [s.id, s.order])),
      hasRoadmap
    }),
    [gates, statuses, hasRoadmap]
  );

  function handleTaskUpdated(updated) {
    setOpenTask(updated);
  }

  const title = isUnscheduledView ? 'Unscheduled' : currentGate ? currentGate.name : projectTitle;
  const subtitle = isUnscheduledView
    ? `${projectTitle} · not yet assigned to a gate`
    : currentGate
      ? `${projectTitle} · gate`
      : hasRoadmap
        ? 'Whole project'
        : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="btn-icon shrink-0"
            onClick={() => navigate(hasRoadmap ? `/projects/${id}/roadmap` : `/projects/${id}`)}
            aria-label="Back"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{title}</h1>
            {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BoardToolbar view={view} onViewChange={setView} sortKey={sortKey} onSortChange={setSortKey} />
          <button className="btn-icon" onClick={() => setSettingsOpen(true)} aria-label="Project settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <BoardFilterBar filters={filters} onChange={setFilters} availableTags={tags} />

      {loading ? (
        <div className="p-8 text-center text-muted">Loading board...</div>
      ) : view === 'board' ? (
        <KanbanBoard onOpenTask={setOpenTask} sortKey={sortKey} workflowContext={workflowContext} columnsOverride={displayColumns} />
      ) : (
        <ListView columns={displayColumns} sortKey={sortKey} workflowContext={workflowContext} onOpenTask={setOpenTask} />
      )}

      {openTask && (
        <TaskDetailModal
          task={openTask}
          statuses={statuses}
          statusOptions={statusOptionsForModal}
          gates={gates}
          tags={tags}
          onClose={() => setOpenTask(null)}
          onUpdated={handleTaskUpdated}
        />
      )}

      {settingsOpen && (
        <ProjectSettingsModal
          projectId={id}
          onClose={() => {
            setSettingsOpen(false);
            loadBoard(id, gateId);
          }}
        />
      )}
    </main>
  );
}
