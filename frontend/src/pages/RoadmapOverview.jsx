import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import ProjectDetailCard from '../components/ProjectDetailCard';
import GateCard from '../components/roadmap/GateCard';
import UnscheduledCard from '../components/roadmap/UnscheduledCard';
import CloseGateModal from '../components/roadmap/CloseGateModal';
import ReopenGateModal from '../components/roadmap/ReopenGateModal';
import QuickAddTaskModal from '../components/roadmap/QuickAddTaskModal';
import ProjectSettingsModal from '../components/settings/ProjectSettingsModal';
import ShareProjectModal from '../components/ShareProjectModal';
import EntityShareModal from '../components/EntityShareModal';
import { useBoardStore } from '../store/boardStore';
import { boardApi, projectsApi, gatesApi } from '../api/endpoints';

const GATE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' }
];

export default function RoadmapOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loadProjectMeta = useBoardStore((s) => s.loadProjectMeta);
  const gates = useBoardStore((s) => s.gates);
  const statuses = useBoardStore((s) => s.statuses);
  const tags = useBoardStore((s) => s.tags);
  const hasRoadmap = useBoardStore((s) => s.hasRoadmap);
  const [unscheduledCount, setUnscheduledCount] = useState(0);
  const [gateFilter, setGateFilter] = useState('all');
  const [closingGate, setClosingGate] = useState(null);
  const [reopeningGate, setReopeningGate] = useState(null);
  const [addingTaskGate, setAddingTaskGate] = useState(undefined);
  const [sharingGate, setSharingGate] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  function refreshProject() {
    return projectsApi.detail(id).then(({ data }) => setProject(data));
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

  // First-visit forced settings prompt (checkpoint c.1.3) -- same rule as
  // ProjectBoard: fires once per project the moment it first loads with
  // hasConfigured false. Covers entry via this page directly (projects that
  // already have a roadmap land here from the dashboard, not on the board).
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

  if (loading || !project) return <main className="p-8 text-center text-muted">Loading roadmap...</main>;

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

      <div className="mb-4 flex items-center justify-between gap-2 border-b border-border">
        <div className="flex gap-1 pb-2">
          <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white">Tasks</button>
          <button className="rounded-md px-3 py-1.5 text-sm font-semibold text-muted hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => navigate(`/projects/${id}/docs`)}>
            Docs
          </button>
        </div>
        <button className="btn-ghost mb-2 hidden sm:inline-flex" onClick={() => navigate(`/projects/${id}/board`)}>
          <LayoutGrid size={16} /> Whole-project board
        </button>
      </div>

      {sortedGates.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-2 dark:bg-slate-800">
          <div className="flex gap-1">
            {GATE_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`rounded-md px-2.5 py-1 text-sm font-semibold transition ${
                  gateFilter === f.key ? 'bg-primary text-white' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                onClick={() => setGateFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button className="btn-ghost ml-auto inline-flex sm:hidden" onClick={() => navigate(`/projects/${id}/board`)}>
            <LayoutGrid size={15} /> Board
          </button>
        </div>
      )}

      {!hasRoadmap && !sortedGates.length && (
        <div className="card p-8 text-center text-muted">
          This project has no roadmap yet. Add a gate from project settings to start one.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    </main>
  );
}
