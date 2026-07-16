import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, Settings, Share2 } from 'lucide-react';
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

export default function RoadmapOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loadProjectMeta = useBoardStore((s) => s.loadProjectMeta);
  const gates = useBoardStore((s) => s.gates);
  const statuses = useBoardStore((s) => s.statuses);
  const hasRoadmap = useBoardStore((s) => s.hasRoadmap);
  const [unscheduledCount, setUnscheduledCount] = useState(0);
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

  const sortedGates = [...gates].sort((a, b) => a.order - b.order);

  if (loading || !project) return <main className="p-8 text-center text-muted">Loading roadmap...</main>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-icon" onClick={() => navigate('/dashboard')} aria-label="Back"><ArrowLeft size={17} /></button>
          <div>
            <h1 className="text-xl font-bold">{project.title} · Roadmap</h1>
            <p className="text-sm text-muted">Gates in sequence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => navigate(`/projects/${id}/board`)}>
            <LayoutGrid size={16} /> Whole-project board
          </button>
          <button className="btn-ghost" onClick={() => setShareModal(true)}><Share2 size={16} /> Share</button>
          <button className="btn-icon" onClick={() => setSettingsOpen(true)} aria-label="Project settings">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <div className="mb-5 border-b border-border">
        <div className="flex gap-1 pb-2">
          <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white">Tasks</button>
          <button className="rounded-md px-3 py-1.5 text-sm font-semibold text-muted hover:bg-slate-50" onClick={() => navigate(`/projects/${id}/docs`)}>
            Docs
          </button>
        </div>
      </div>

      {!hasRoadmap && !sortedGates.length && (
        <div className="card p-8 text-center text-muted">
          This project has no roadmap yet. Add a gate from project settings to start one.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedGates.map((gate) => (
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
        <UnscheduledCard
          count={unscheduledCount}
          onOpen={() => navigate(`/projects/${id}/board?gateId=unscheduled`)}
          onAddTask={() => setAddingTaskGate(null)}
        />
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
