import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StatusSettingsList from '../components/settings/StatusSettingsList';
import GateSettingsList from '../components/settings/GateSettingsList';
import TagSettingsList from '../components/settings/TagSettingsList';
import { useBoardStore } from '../store/boardStore';
import { projectsApi } from '../api/endpoints';

export default function ProjectSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loadProjectMeta = useBoardStore((s) => s.loadProjectMeta);
  const statuses = useBoardStore((s) => s.statuses);
  const gates = useBoardStore((s) => s.gates);
  const tags = useBoardStore((s) => s.tags);
  const [projectTitle, setProjectTitle] = useState('');
  const [loading, setLoading] = useState(true);

  function refresh() {
    return loadProjectMeta(id);
  }

  useEffect(() => {
    Promise.all([refresh(), projectsApi.detail(id).then(({ data }) => setProjectTitle(data.title))]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <main className="p-8 text-center text-muted">Loading settings...</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <button className="btn-icon" onClick={() => navigate(`/projects/${id}`)} aria-label="Back"><ArrowLeft size={17} /></button>
        <div>
          <h1 className="text-xl font-bold">{projectTitle} · Settings</h1>
          <p className="text-sm text-muted">Statuses, gates, and tags</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Statuses</h2>
        <p className="mb-3 text-sm text-muted">Exactly one status is the &ldquo;Done&rdquo; status -- it's the only one that counts toward progress.</p>
        <StatusSettingsList statuses={statuses} onChange={refresh} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Gates</h2>
        <p className="mb-3 text-sm text-muted">Adding a gate starts this project's roadmap.</p>
        <GateSettingsList gates={gates} projectId={id} onChange={refresh} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Tags</h2>
        <TagSettingsList tags={tags} onChange={refresh} />
      </section>
    </main>
  );
}
