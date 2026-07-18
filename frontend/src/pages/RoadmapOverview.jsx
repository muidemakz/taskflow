import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import ProjectDetailCard from '../components/ProjectDetailCard';
import ProjectTabs from '../components/ProjectTabs';
import SharedFilterBar from '../components/SharedFilterBar';
import GateCard from '../components/roadmap/GateCard';
import UnscheduledCard from '../components/roadmap/UnscheduledCard';
import CloseGateModal from '../components/roadmap/CloseGateModal';
import ReopenGateModal from '../components/roadmap/ReopenGateModal';
import QuickAddTaskModal from '../components/roadmap/QuickAddTaskModal';
import ProjectSettingsModal from '../components/settings/ProjectSettingsModal';
import ShareProjectModal from '../components/ShareProjectModal';
import EntityShareModal from '../components/EntityShareModal';
import DocEditModal from '../components/docs/DocEditModal';
import { useBoardStore } from '../store/boardStore';
import { boardApi, projectsApi, gatesApi, docsApi, docCategoriesApi } from '../api/endpoints';

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
// across a tab switch -- only the panel below (gates grid vs. docs list) and
// the filter-bar contents (driven by activeTab) change. Tab state lives in
// ?tab= so it's linkable/refreshable without remounting the page.
export default function RoadmapOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'docs' ? 'docs' : 'tasks';

  const loadProjectMeta = useBoardStore((s) => s.loadProjectMeta);
  const gates = useBoardStore((s) => s.gates);
  const statuses = useBoardStore((s) => s.statuses);
  const tags = useBoardStore((s) => s.tags);
  const hasRoadmap = useBoardStore((s) => s.hasRoadmap);

  const [unscheduledCount, setUnscheduledCount] = useState(0);
  const [gateFilter, setGateFilter] = useState('');
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
    setSearchParams(tab === 'docs' ? { tab: 'docs' } : {}, { replace: true });
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
      />

      {activeTab === 'tasks' ? (
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
      ) : (
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

      {activeTab === 'tasks' ? (
        <>
          {!hasRoadmap && !sortedGates.length && (
            <div className="card mt-3 p-8 text-center text-muted">
              This project has no roadmap yet. Add a gate from project settings to start one.
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleGates.map((gate) => (
              <GateCard
                key={gate.id}
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
              <UnscheduledCard
                count={unscheduledCount}
                onOpen={() => navigate(`/projects/${id}/board?gateId=unscheduled`)}
                onAddTask={() => setAddingTaskGate(null)}
              />
            )}
          </div>
        </>
      ) : (
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

      {closingGate && (
        <CloseGateModal
          gate={closingGate}
          onClose={() => setClosingGate(null)}
          onDone={() => {
            setClosingGate(null);
            loadProjectMeta(id);
            boardApi.get(id).then(({ data }) => setUnscheduledCount(data.unassignedCount));
          }}
        />
      )}

      {reopeningGate && (
        <ReopenGateModal
          gate={reopeningGate}
          onClose={() => setReopeningGate(null)}
          onDone={() => {
            setReopeningGate(null);
            loadProjectMeta(id);
          }}
        />
      )}

      {addingTaskGate !== undefined && (
        <QuickAddTaskModal
          projectId={id}
          gate={addingTaskGate}
          statuses={statuses}
          onClose={() => setAddingTaskGate(undefined)}
          onCreated={() => {
            setAddingTaskGate(undefined);
            loadProjectMeta(id);
            boardApi.get(id).then(({ data }) => setUnscheduledCount(data.unassignedCount));
          }}
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
            loadProjectMeta(id);
            boardApi.get(id).then(({ data }) => setUnscheduledCount(data.unassignedCount));
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
