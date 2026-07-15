import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import GateCard from '../components/roadmap/GateCard';
import UnscheduledCard from '../components/roadmap/UnscheduledCard';
import CloseGateModal from '../components/roadmap/CloseGateModal';
import { useBoardStore } from '../store/boardStore';
import { boardApi, projectsApi } from '../api/endpoints';

export default function RoadmapOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loadProjectMeta = useBoardStore((s) => s.loadProjectMeta);
  const gates = useBoardStore((s) => s.gates);
  const hasRoadmap = useBoardStore((s) => s.hasRoadmap);
  const [unscheduledCount, setUnscheduledCount] = useState(0);
  const [closingGate, setClosingGate] = useState(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadProjectMeta(id),
      boardApi.get(id).then(({ data }) => setUnscheduledCount(data.unassignedCount)),
      projectsApi.detail(id).then(({ data }) => setProjectTitle(data.title))
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sortedGates = [...gates].sort((a, b) => a.order - b.order);

  if (loading) return <main className="p-8 text-center text-muted">Loading roadmap...</main>;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-icon" onClick={() => navigate(`/projects/${id}`)} aria-label="Back"><ArrowLeft size={17} /></button>
          <div>
            <h1 className="text-xl font-bold">{projectTitle} · Roadmap</h1>
            <p className="text-sm text-muted">Gates in sequence</p>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => navigate(`/projects/${id}/board`)}>
          <LayoutGrid size={16} /> Whole-project board
        </button>
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
          />
        ))}
        <UnscheduledCard count={unscheduledCount} onOpen={() => navigate(`/projects/${id}/board?gateId=unscheduled`)} />
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
    </main>
  );
}
