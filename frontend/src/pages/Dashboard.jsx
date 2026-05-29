import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Modal from '../components/Modal';
import ProjectCard from '../components/ProjectCard';
import { useProjectStore } from '../store/projectStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, loading, loadProjects, createProject, deleteProject } = useProjectStore();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });

  useEffect(() => { loadProjects(); }, [loadProjects]);

  async function submit(event) {
    event.preventDefault();
    const project = await createProject(form);
    setModal(false);
    setForm({ title: '', description: '' });
    navigate(`/projects/${project.id}`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-sm text-muted">Create projects, track work, and share read-only progress.</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}><Plus size={17} /> New Project</button>
      </div>
      {loading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div className="card h-44 animate-pulse bg-slate-100" key={i} />)}</div>}
      {!loading && !projects.length && (
        <div className="card p-10 text-center">
          <h2 className="text-lg font-semibold">No projects yet.</h2>
          <p className="mt-2 text-muted">Create your first project to start building a checklist.</p>
          <button className="btn-primary mt-5" onClick={() => setModal(true)}>Create project</button>
        </div>
      )}
      {!loading && Boolean(projects.length) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => navigate(`/projects/${project.id}`)}
              onDelete={async () => { if (confirm(`Delete "${project.title}"?`)) await deleteProject(project.id); }}
            />
          ))}
        </div>
      )}
      {modal && (
        <Modal title="New Project" onClose={() => setModal(false)}>
          <form onSubmit={submit} className="space-y-3">
            <input className="field" placeholder="Project title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <textarea className="field min-h-24" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn-primary">Create</button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
