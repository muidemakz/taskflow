import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Star } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import ProjectDetailCard from '../components/ProjectDetailCard';
import ProjectTabs from '../components/ProjectTabs';
import SharedFilterBar from '../components/SharedFilterBar';
import TagMultiSelect from '../components/TagMultiSelect';
import RoadmapCard from '../components/roadmap/RoadmapCard';
import CloseGateModal from '../components/roadmap/CloseGateModal';
import ReopenGateModal from '../components/roadmap/ReopenGateModal';
import QuickAddTaskModal from '../components/roadmap/QuickAddTaskModal';
import ProjectSettingsModal from '../components/settings/ProjectSettingsModal';
import ShareProjectModal from '../components/ShareProjectModal';
import EntityShareModal from '../components/EntityShareModal';
import DocEditModal from '../components/docs/DocEditModal';
import KanbanBoard from '../components/board/KanbanBoard';
import ListView from '../components/board/ListView';
import BoardToolbar from '../components/board/BoardToolbar';
import TaskDetailModal from '../components/board/TaskDetailModal';
import { useBoardStore } from '../store/boardStore';
import { boardApi, projectsApi, gatesApi, docsApi, docCategoriesApi } from '../api/endpoints';
import { EMPTY_FILTERS, filterTasks } from '../utils/board';

const GATE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' }
];

const DOC_STATUS_FILTERS = [
  ['', 'All'],
  ['ACTIVE', 'Active'],
  ['RETIRED', 'Retired']
];

function formatDocDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Unified project workspace: Tasks and Docs are tabs of ONE mounted page, not
// separate routes. Breadcrumb, ProjectDetailCard, and the tabs row stay put
// across a tab switch -- only the panel below and the filter-bar contents
// (driven by activeTab, and for Tasks, by boardMode) change. The Tasks tab
// itself has two sub-views: the gates grid (default) and the whole-project
// board (kanban/list across every gate), toggled via ?view=board so it's
// linkable and survives a refresh without remounting the page.
export default function RoadmapOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'docs' ? 'docs' : 'tasks';
  const boardMode = activeTab === 'tasks' && searchParams.get('view') === 'board' ? 'board' : 'gates';

  const loadProjectMeta = useBoardStore((s) => s.loadProjectMeta);
  const loadBoard = useBoardStore((s) => s.loadBoard);
  const gates = useBoardStore((s) => s.gates);
  const statuses = useBoardStore((s) => s.statuses);
  const tags = useBoardStore((s) => s.tags);
  const hasRoadmap = useBoardStore((s) => s.hasRoadmap);
  const columns = useBoardStore((s) => s.columns);
  const boardLoading = useBoardStore((s) => s.loading);
  const kanbanView = useBoardStore((s) => s.view);
  const sortKey = useBoardStore((s) => s.sortKey);
  const setKanbanView = useBoardStore((s) => s.setView);
  const setSortKey = useBoardStore((s) => s.setSortKey);

  const [unscheduledCount, setUnscheduledCount] = useState(0);
  const [gateFilter, setGateFilter] = useState('');
  const [boardFilters, setBoardFilters] = useState(EMPTY_FILTERS);
  const [openTask, setOpenTask] = useState(null);
  const [closingGate, setClosingGate] = useState(null);
  const [reopeningGate, setReopeningGate] = useState(null);
  const [addingTaskGate, setAddingTaskGate] = useState(undefined);
  const [sharingGate, setSharingGate] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const [docs, setDocs] = useState(null);
  const [categories, setCategories] = useState([]);
  const [docSearch, setDocSearch] = useState('');
  const [docStatus, setDocStatus] = useState('');
  const [docCategoryIds, setDocCategoryIds] = useState([]);
  const [creatingDoc, setCreatingDoc] = useState(false);

  const highlightTaskId = searchParams.get('taskId');
  const highlightApplied = useRef(false);

  function refreshProject() {
    return projectsApi.detail(id).then(({ data }) => setProject(data));
  }

  function reloadDocs() {
    docsApi.list(id).then(({ data }) => setDocs(data));
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadProjectMeta(id),
      boardApi.get(id).then(({ data }) => setUnscheduledCount(data.unassignedCount)),
      refreshProject()
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Docs load once per project, not per tab switch, so flipping tabs never
  // refetches or remounts anything.
  useEffect(() => {
    reloadDocs();
    docCategoriesApi.list(id).then(({ data }) => setCategories(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Whole-project board data loads only when that sub-view is actually
  // shown, not on every Tasks-tab visit -- viewing the gates grid never
  // needs board columns.
  useEffect(() => {
    if (boardMode === 'board') loadBoard(id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, boardMode]);

  // Landing here from a /board?taskId=... deep link (redirected in by
  // ProjectBoard.jsx) opens that task directly instead of leaving the user
  // to find it themselves among possibly many columns.
  useEffect(() => {
    if (boardMode !== 'board' || !highlightTaskId || highlightApplied.current || !columns.length) return;
    const found = columns.flatMap((c) => c.tasks).find((t) => t.id === highlightTaskId);
    if (found) {
      setOpenTask(found);
      highlightApplied.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardMode, highlightTaskId, columns]);

  // First-visit forced settings prompt (checkpoint c.1.3) -- fires once per
  // project the moment it first loads with hasConfigured false.
  const firstVisitChecked = useRef(false);
  useEffect(() => {
    if (project && !project.hasConfigured && !firstVisitChecked.current) {
      firstVisitChecked.current = true;
      setSettingsOpen(true);
    }
  }, [project]);

  const sortedGates = useMemo(() => [...gates].sort((a, b) => a.order - b.order), [gates]);
  const visibleGates = useMemo(() => {
    if (gateFilter === 'open') return sortedGates.filter((g) => g.status !== 'CLOSED');
    if (gateFilter === 'closed') return sortedGates.filter((g) => g.status === 'CLOSED');
    return sortedGates;
  }, [sortedGates, gateFilter]);

  const displayColumns = useMemo(
    () => columns.map((col) => ({ ...col, tasks: filterTasks(col.tasks, boardFilters) })),
    [columns, boardFilters]
  );

  const workflowContext = useMemo(
    () => ({
      gateOrderById: Object.fromEntries(gates.map((g) => [g.id, g.order])),
      statusOrderById: Object.fromEntries(statuses.map((s) => [s.id, s.order])),
      hasRoadmap
    }),
    [gates, statuses, hasRoadmap]
  );

  const filteredDocs = useMemo(() => {
    if (!docs) return [];
    return docs.filter((doc) => {
      if (docCategoryIds.length) {
        const catKey = doc.categoryId || 'none';
        if (!docCategoryIds.includes(catKey)) return false;
      }
      if (docStatus && doc.status !== docStatus) return false;
      if (docSearch.trim()) {
        const q = docSearch.trim().toLowerCase();
        if (!doc.title.toLowerCase().includes(q) && !doc.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [docs, docStatus, docCategoryIds, docSearch]);

  function selectTab(tab) {
    if (tab === 'docs') {
      setSearchParams({ tab: 'docs' }, { replace: true });
      return;
    }
    // Switching back to Tasks restores whichever sub-view (gates/board) was
    // last active, rather than always resetting to the gates grid.
    setSearchParams(searchParams.get('view') === 'board' ? { view: 'board' } : {}, { replace: true });
  }

  function toggleBoardView() {
    setSearchParams(boardMode === 'board' ? {} : { view: 'board' }, { replace: true });
  }

  function refreshGateContext() {
    loadProjectMeta(id);
    loadBoard(id, null);
    boardApi.get(id).then(({ data }) => setUnscheduledCount(data.unassignedCount));
  }

  if (loading || !project) return <main className="p-8 text-center text-muted">Loading project...</main>;

  return (
    <main className="page-container py-6">
      <Breadcrumb items={[{ label: 'Projects', to: '/dashboard' }, { label: project.title }]} onBack={() => navigate('/dashboard')} />

      <ProjectDetailCard
        project={project}
        stats={project.stats}
        tagCount={tags.length}
        onShare={() => setShareModal(true)}
        onSettings={() => setSettingsOpen(true)}
        onAddTask={() => setAddingTaskGate(null)}
      />

      <ProjectTabs
        projectId={id}
        active={activeTab}
        onSelectTab={selectTab}
        onNewEntry={activeTab === 'docs' ? () => setCreatingDoc(true) : undefined}
        boardMode={activeTab === 'tasks' ? boardMode : undefined}
        onToggleBoardView={activeTab === 'tasks' ? toggleBoardView : undefined}
      />

      {activeTab === 'tasks' && boardMode === 'gates' && (
        <SharedFilterBar
          filters={{ gateFilter }}
          onChange={(next) => setGateFilter(next.gateFilter ?? '')}
          onClear={() => setGateFilter('')}
          showSearch={false}
          filterFields={[
            {
              key: 'gateFilter',
              render: (f, set) => (
                <div className="flex gap-1 rounded-md border border-border bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
                  {GATE_FILTERS.map((gf) => (
                    <button
                      key={gf.key}
                      className={`rounded px-3 py-1.5 text-sm font-semibold ${f.gateFilter === gf.key ? 'bg-primary text-white' : 'text-muted'}`}
                      onClick={() => set({ gateFilter: gf.key })}
                    >
                      {gf.label}
                    </button>
                  ))}
                </div>
              )
            }
          ]}
        />
      )}

      {activeTab === 'tasks' && boardMode === 'board' && (
        <SharedFilterBar
          filters={boardFilters}
          onChange={setBoardFilters}
          onClear={() => setBoardFilters(EMPTY_FILTERS)}
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
                      onRemove={(tagId) => set({ tagIds: f.tagIds.filter((tid) => tid !== tagId) })}
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
      )}

      {activeTab === 'docs' && (
        <SharedFilterBar
          filters={{ search: docSearch, status: docStatus, categoryIds: docCategoryIds }}
          onChange={(next) => {
            setDocSearch(next.search ?? '');
            setDocStatus(next.status ?? '');
            setDocCategoryIds(next.categoryIds ?? []);
          }}
          onClear={() => { setDocSearch(''); setDocStatus(''); setDocCategoryIds([]); }}
          placeholder="Search title or body..."
          filterFields={[
            {
              key: 'status',
              render: (f, set) => (
                <div className="flex rounded-md border border-border bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
                  {DOC_STATUS_FILTERS.map(([value, label]) => (
                    <button
                      key={value}
                      className={`rounded px-3 py-1.5 text-sm font-semibold ${f.status === value ? 'bg-primary text-white' : 'text-muted'}`}
                      onClick={() => set({ status: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )
            },
            {
              key: 'categoryIds',
              render: (f, set) => (
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: 'none', name: 'Uncategorized' }, ...categories].map((cat) => (
                    <button
                      key={cat.id}
                      className={`chip border ${f.categoryIds.includes(cat.id) ? 'border-primary bg-blue-50 text-primary dark:border-blue-600 dark:bg-blue-900/40 dark:text-blue-300' : 'border-border text-muted dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                      onClick={() => set({ categoryIds: f.categoryIds.includes(cat.id) ? f.categoryIds.filter((c) => c !== cat.id) : [...f.categoryIds, cat.id] })}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )
            }
          ]}
        />
      )}

      {activeTab === 'tasks' && boardMode === 'gates' && (
        <>
          {!hasRoadmap && !sortedGates.length && (
            <div className="card mt-3 p-8 text-center text-muted">
              This project has no roadmap yet. Add a gate from project settings to start one.
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGates.map((gate) => (
              <RoadmapCard
                key={gate.id}
                kind="gate"
                gate={gate}
                onOpen={(g) => navigate(`/projects/${id}/board?gateId=${g.id}`)}
                onCloseGate={setClosingGate}
                onReopenGate={setReopeningGate}
                onAddTask={setAddingTaskGate}
                onShareGate={setSharingGate}
                onEditGate={() => setSettingsOpen(true)}
              />
            ))}
            {gateFilter !== 'closed' && (
              <RoadmapCard
                kind="unscheduled"
                count={unscheduledCount}
                onOpen={() => navigate(`/projects/${id}/board?gateId=unscheduled`)}
                onAddTask={() => setAddingTaskGate(null)}
                onShareProject={() => setShareModal(true)}
              />
            )}
          </div>
        </>
      )}

      {activeTab === 'tasks' && boardMode === 'board' && (
        <>
          <div className="mt-3 flex justify-end">
            <BoardToolbar view={kanbanView} onViewChange={setKanbanView} sortKey={sortKey} onSortChange={setSortKey} />
          </div>

          {boardLoading ? (
            <div className="p-8 text-center text-muted">Loading board...</div>
          ) : kanbanView === 'board' ? (
            <KanbanBoard onOpenTask={setOpenTask} sortKey={sortKey} workflowContext={workflowContext} columnsOverride={displayColumns} />
          ) : (
            <ListView columns={displayColumns} sortKey={sortKey} workflowContext={workflowContext} onOpenTask={setOpenTask} />
          )}
        </>
      )}

      {activeTab === 'docs' && (
        <>
          {!filteredDocs.length && <div className="card mt-3 p-10 text-center text-muted">No docs match.</div>}

          {Boolean(filteredDocs.length) && (
            <div className="card mt-3 divide-y divide-slate-100 dark:divide-slate-700">
              {filteredDocs.map((doc) => (
                <button
                  key={doc.id}
                  className="flex w-full flex-col gap-1.5 px-3 py-3 text-left text-sm transition hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-3 dark:hover:bg-slate-900/50"
                  onClick={() => navigate(`/projects/${id}/docs/${doc.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{doc.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{doc.category?.name || 'Uncategorized'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`chip shrink-0 ${doc.status === 'RETIRED' ? 'bg-slate-100 text-muted dark:bg-slate-700 dark:text-slate-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                      {doc.status === 'RETIRED' ? 'Retired' : 'Active'}
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs text-muted">{formatDocDate(doc.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {openTask && (
        <TaskDetailModal
          task={openTask}
          statuses={statuses}
          gates={gates}
          tags={tags}
          promptRulesCategoryId={project.promptRulesCategoryId}
          onClose={() => setOpenTask(null)}
          onUpdated={(updated) => setOpenTask(updated)}
        />
      )}

      {closingGate && (
        <CloseGateModal
          gate={closingGate}
          onClose={() => setClosingGate(null)}
          onDone={() => { setClosingGate(null); refreshGateContext(); }}
        />
      )}

      {reopeningGate && (
        <ReopenGateModal
          gate={reopeningGate}
          onClose={() => setReopeningGate(null)}
          onDone={() => { setReopeningGate(null); refreshGateContext(); }}
        />
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

      {settingsOpen && (
        <ProjectSettingsModal
          projectId={id}
          onClose={() => {
            setSettingsOpen(false);
            refreshGateContext();
            if (project && !project.hasConfigured) {
              projectsApi.update(id, { hasConfigured: true }).then(refreshProject);
            }
          }}
        />
      )}

      {shareModal && (
        <ShareProjectModal
          project={project}
          onToggleShare={async (enabled) => {
            const { data } = await projectsApi.share(id, { shareEnabled: enabled });
            setProject(data);
          }}
          onClose={() => setShareModal(false)}
        />
      )}

      {creatingDoc && (
        <DocEditModal
          projectId={id}
          categories={categories}
          onClose={() => setCreatingDoc(false)}
          onSaved={(doc) => navigate(`/projects/${id}/docs/${doc.id}`)}
        />
      )}
    </main>
  );
}
