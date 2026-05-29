import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { shareApi } from '../api/endpoints';
import GroupCard from '../components/GroupCard';
import ProgressBar from '../components/ProgressBar';
import TaskCard from '../components/TaskCard';
import { orderedEntries, stats } from '../utils/project';

export default function ShareView() {
  const { shareToken } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    shareApi.detail(shareToken)
      .then(({ data }) => setProject(data))
      .catch((err) => setError(err.response?.data?.message || 'This project is no longer shared'));
  }, [shareToken]);

  if (error) {
    return <main className="flex min-h-screen items-center justify-center p-4"><div className="card max-w-md p-6 text-center"><h1 className="text-xl font-bold">Share unavailable</h1><p className="mt-2 text-muted">{error}</p></div></main>;
  }
  if (!project) return <div className="p-8 text-center text-muted">Loading shared project...</div>;
  const st = stats(project);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-primary">
        Viewing shared project — {project.owner?.name}'s {project.title}
      </div>
      <section className="card mb-5 p-5">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="mt-2 text-muted">{project.description}</p>
        <div className="mt-4">
          <ProgressBar value={st.pct} />
          <p className="mt-2 text-sm text-muted">{st.done} of {st.total} done · {st.pct}%</p>
        </div>
        <Link className="btn-primary mt-5" to="/register">Create your own Taskflow account <ArrowRight size={16} /></Link>
      </section>
      <div className="space-y-3">
        {orderedEntries(project).map((entry) => entry.type === 'task'
          ? <TaskCard key={entry.key} task={entry.item} readOnly />
          : <GroupCard key={entry.key} group={entry.item} groups={project.groups} readOnly />)}
      </div>
    </main>
  );
}
