import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Settings, Share2, Star } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import GateDetailCard from '../components/roadmap/GateDetailCard';
import KanbanBoard from '../components/board/KanbanBoard';
import ListView from '../components/board/ListView';
import BoardToolbar from '../components/board/BoardToolbar';
import SharedFilterBar from '../components/SharedFilterBar';
import TagMultiSelect from '../components/TagMultiSelect';
import TaskDetailModal from '../components/board/TaskDetailModal';
import ProjectSettingsModal from '../components/settings/ProjectSettingsModal';
import CloseGateModal from '../components/roadmap/CloseGateModal';
import ReopenGateModal from '../components/roadmap/ReopenGateModal';
import QuickAddTaskModal from '../components/roadmap/QuickAddTaskModal';
import ShareProjectModal from '../components/ShareProjectModal';
import EntityShareModal from '../components/EntityShareModal';
import { useBoardStore } from '../store/boardStore';
import { projectsApi, gatesApi } from '../api/endpoints';
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
  const [project, setProject] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [openTask, setOpenTask] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareProjectOpen, setShareProjectOpen] = useState(false);
  const [sharingGate, setSharingGate] = useState(null);
  const [closingGate, setClosingGate] = useState(null);
  const [reopeningGate, setReopeningGate] = useState(null);
  const [addingTaskGate, setAddingTaskGate] = useState(undefined);
  const highlightTaskId = searchParams.get('taskId');
  const highlightApplied = useRef(false);

  function refreshProject() {
    return projectsApi.detail(id).then(({ data }) => setProject(data));
  }

  useEffect(() => {
    loadProjectMeta(id);
    refreshProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // First-visit forced settings prompt (checkpoint c.1.3): fires once per
  // project, the moment its detail first loads with hasConfigured false.
  // The ref (not just the project field) guards against re-opening while
  // the PATCH from closing the modal is still in flight.
  const firstVisitChecked = useRef(false);
  useEffect(() => {
    if (project && !project.hasConfigured && !firstVisitChecked.current) {
      firstVisitChecked.current = true;
      setSettingsOpen(true);
    }
  }, [project]);

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

  const sortedGates = [...gates].sort((a, b) => a.order - b.order);
  const currentGate = gates.find((g) => g.id === gateId);
  const currentGateIndex = currentGate ? sortedGates.findIndex((g) => g.id === currentGate.id) : -1;
  const prevGate = currentGateIndex > 0 ? sortedGates[currentGateIndex - 1] : null;
  const nextGate = currentGateIndex >= 0 && currentGateIndex < sortedGates.length - 1 ? sortedGates[currentGateIndex + 1] : null;

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

  function refreshGateContext() {
    loadProjectMeta(id);
    loadBoard(id, gateId);
  }

  const projectTitle = project?.title || '';
  const title = isUnscheduledView ? 'Unscheduled' : currentGate ? currentGate.name : projectTitle;
  const subtitle = isUnscheduledView
    ? `${projectTitle} · not yet assigned to a gate`
    : currentGate
      ? `${projectTitle} · gate`
      : hasRoadmap
        ? 'Whole project'
        : null;

  // Breadcrumb: Projects / [Project] / [leaf]. The project crumb links to the
  // roadmap when there is one (its true parent view); a roadmap-less project's
  // board IS its home, so it stays the leaf with no third crumb.
  const breadcrumbItems = [{ label: 'Projects', to: '/dashboard' }];
  if (currentGate) {
    const gateLetter = String.fromCharCode(65 + (currentGate.order ?? 0));
    breadcrumbItems.push({ label: projectTitle, to: `/projects/${id}/roadmap` });
    breadcrumbItems.push({ label: `${gateLetter} · ${currentGate.name}` });
  } else if (isUnscheduledView) {
    breadcrumbItems.push({ label: projectTitle, to: `/projects/${id}/roadmap` });
    breadcrumbItems.push({ label: 'Unscheduled' });
  } else if (hasRoadmap) {
    breadcrumbItems.push({ label: projectTitle, to: `/projects/${id}/roadmap` });
    breadcrumbItems.push({ label: 'Whole project' });
  } else {
    breadcrumbItems.push({ label: projectTitle });
  }

  // Back always goes one level up the trail above: into the roadmap for any
  // gate/unscheduled/whole-project view, or the dashboard when this board IS
  // the project's home (no roadmap).
  const backTo = hasRoadmap ? `/projects/${id}/roadmap` : '/dashboard';

  if (!project) return <main className="p-8 text-center text-muted">Loading board...</main>;

  return (
    <main className="page-container py-6">
      <Breadcrumb items={breadcrumbItems} onBack={() => navigate(backTo)} />

      {currentGate ? (
        <>
          <GateDetailCard
            gate={currentGate}
            onAddTask={(g) => setAddingTaskGate(g)}
            onShareGate={setSharingGate}
            onCloseGate={setClosingGate}
            onReopenGate={setReopeningGate}
          />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-white p-1 dark:bg-slate-800">
              <button
                className="btn-icon h-7 w-7 border-none"
                disabled={!prevGate}
                onClick={() => navigate(`/projects/${id}/board?gateId=${prevGate.id}`)}
                aria-label="Previous gate"
              >
                <ChevronLeft size={14} />
              </button>
              <select
                className="border-0 bg-transparent text-sm font-semibold outline-none dark:bg-slate-800"
                value={currentGate.id}
                onChange={(e) => navigate(`/projects/${id}/board?gateId=${e.target.value}`)}
              >
                {sortedGates.map((g) => <option key={g.id} value={g.id}>{g.name}{g.status === 'CLOSED' ? ' (Closed)' : ''}</option>)}
              </select>
              <button
                className="btn-icon h-7 w-7 border-none"
                disabled={!nextGate}
                onClick={() => navigate(`/projects/${id}/board?gateId=${nextGate.id}`)}
                aria-label="Next gate"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="ml-auto">
              <BoardToolbar view={view} onViewChange={setView} sortKey={sortKey} onSortChange={setSortKey} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">{title}</h1>
              {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {isUnscheduledView && (
                <button className="btn-ghost" onClick={() => setAddingTaskGate(null)}>
                  <Plus size={14} /> Add task
                </button>
              )}
              <BoardToolbar view={view} onViewChange={setView} sortKey={sortKey} onSortChange={setSortKey} />
              <button className="btn-ghost" onClick={() => setShareProjectOpen(true)}><Share2 size={16} /> Share</button>
              <button className="btn-icon" onClick={() => setSettingsOpen(true)} aria-label="Project settings">
                <Settings size={16} />
              </button>
            </div>
          </div>

          {!isUnscheduledView && (
            <div className="mb-4 border-b border-border">
              <div className="flex gap-1 pb-2">
                <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white">Tasks</button>
                <button className="rounded-md px-3 py-1.5 text-sm font-semibold text-muted hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => navigate(`/projects/${id}/roadmap?tab=docs`)}>
                  Docs
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <SharedFilterBar
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters({ tagIds: [], priority: '', blockedOnly: false, focusOnly: false, dueFilter: '' })}
        showSearch={false}
        filterFields={[
          {
            key: 'tagIds',
            render: (f, set) => {
              const selectedTags = tags.filter((t) => f.tagIds.includes(t.id));
              return (
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-semibold ${selectedTags.length ? 'text-primary' : 'text-muted'}`}>
                    Tags{selectedTags.length ? ` (${selectedTags.length})` : ''}
                  </span>
                  <TagMultiSelect
                    selectedTags={selectedTags}
                    availableTags={tags}
                    onAdd={(tagId) => set({ tagIds: [...f.tagIds, tagId] })}
                    onRemove={(tagId) => set({ tagIds: f.tagIds.filter((id) => id !== tagId) })}
                  />
                </div>
              );
            }
          },
          {
            key: 'priority',
            render: (f, set) => (
              <select className="field w-auto dark:bg-slate-700 dark:text-white dark:border-slate-600" value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
                <option value="">Any priority</option>
                <option value="HIGH">High</option>
                <option value="MID">Mid</option>
                <option value="LOW">Low</option>
                <option value="NONE">None</option>
              </select>
            )
          },
          {
            key: 'blockedOnly',
            render: (f, set) => (
              <button
                className={`btn-ghost ${f.blockedOnly ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/40 dark:text-red-300' : ''}`}
                onClick={() => set({ blockedOnly: !f.blockedOnly })}
              >
                <AlertTriangle size={14} /> Blocked only
              </button>
            )
          },
          {
            key: 'focusOnly',
            render: (f, set) => (
              <button
                className={`btn-ghost ${f.focusOnly ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/40 dark:text-amber-300' : ''}`}
                onClick={() => set({ focusOnly: !f.focusOnly })}
              >
                <Star size={14} /> Focus only
              </button>
            )
          },
          {
            key: 'dueFilter',
            render: (f, set) => (
              <select className="field w-auto dark:bg-slate-700 dark:text-white dark:border-slate-600" value={f.dueFilter} onChange={(e) => set({ dueFilter: e.target.value })}>
                <option value="">Any due date</option>
                <option value="overdue">Overdue</option>
                <option value="thisWeek">Due this week</option>
                <option value="hasDate">Has a date</option>
                <option value="noDate">No date</option>
              </select>
            )
          }
        ]}
      />

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
          gates={gates}
          tags={tags}
          promptRulesCategoryId={project.promptRulesCategoryId}
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
            if (project && !project.hasConfigured) {
              projectsApi.update(id, { hasConfigured: true }).then(refreshProject);
            }
          }}
        />
      )}

      {shareProjectOpen && (
        <ShareProjectModal
          project={project}
          onToggleShare={async (enabled) => {
            const { data } = await projectsApi.share(id, { shareEnabled: enabled });
            setProject(data);
          }}
          onClose={() => setShareProjectOpen(false)}
        />
      )}

      {sharingGate && (
        <EntityShareModal
          title={`Share ${sharingGate.name}`}
          entity={sharingGate}
          onToggleShare={async (enabled) => {
            const { data } = await gatesApi.share(sharingGate.id, { shareEnabled: enabled });
            setSharingGate(data);
            loadProjectMeta(id);
          }}
          onClose={() => setSharingGate(null)}
        />
      )}

      {closingGate && (
        <CloseGateModal gate={closingGate} onClose={() => setClosingGate(null)} onDone={() => { setClosingGate(null); refreshGateContext(); }} />
      )}

      {reopeningGate && (
        <ReopenGateModal gate={reopeningGate} onClose={() => setReopeningGate(null)} onDone={() => { setReopeningGate(null); refreshGateContext(); }} />
      )}

      {addingTaskGate !== undefined && (
        <QuickAddTaskModal
          projectId={id}
          gate={addingTaskGate}
          statuses={statuses}
          onClose={() => setAddingTaskGate(undefined)}
          onCreated={() => { setAddingTaskGate(undefined); refreshGateContext(); }}
        />
      )}
    </main>
  );
}
