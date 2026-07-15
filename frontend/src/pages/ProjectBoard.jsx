import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import KanbanBoard from '../components/board/KanbanBoard';
import ListView from '../components/board/ListView';
import BoardToolbar from '../components/board/BoardToolbar';
import { useBoardStore } from '../store/boardStore';
import { projectsApi } from '../api/endpoints';

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
  const hasRoadmap = useBoardStore((s) => s.hasRoadmap);
  const view = useBoardStore((s) => s.view);
  const sortKey = useBoardStore((s) => s.sortKey);
  const setView = useBoardStore((s) => s.setView);
  const setSortKey = useBoardStore((s) => s.setSortKey);
  const loading = useBoardStore((s) => s.loading);
  const [projectTitle, setProjectTitle] = useState('');

  useEffect(() => {
    loadProjectMeta(id);
    projectsApi.detail(id).then(({ data }) => setProjectTitle(data.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadBoard(id, gateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, gateId]);

  const displayColumns = useMemo(() => {
    if (!isUnscheduledView) return columns;
    return columns.map((col) => ({ ...col, tasks: col.tasks.filter((t) => !t.gateId) }));
  }, [columns, isUnscheduledView]);

  const currentGate = gates.find((g) => g.id === gateId);
  const workflowContext = useMemo(
    () => ({
      gateOrderById: Object.fromEntries(gates.map((g) => [g.id, g.order])),
      statusOrderById: Object.fromEntries(statuses.map((s) => [s.id, s.order])),
      hasRoadmap
    }),
    [gates, statuses, hasRoadmap]
  );

  function handleOpenTask() {
    // Task detail view lands in the next checkpoint.
    toast('Task detail view is coming in the next checkpoint.');
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
        <BoardToolbar view={view} onViewChange={setView} sortKey={sortKey} onSortChange={setSortKey} />
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted">Loading board...</div>
      ) : view === 'board' ? (
        <KanbanBoard onOpenTask={handleOpenTask} sortKey={sortKey} workflowContext={workflowContext} columnsOverride={isUnscheduledView ? displayColumns : null} />
      ) : (
        <ListView columns={displayColumns} sortKey={sortKey} workflowContext={workflowContext} onOpenTask={handleOpenTask} />
      )}
    </main>
  );
}
