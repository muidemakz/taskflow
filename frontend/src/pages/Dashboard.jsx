import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import ProjectCard from '../components/ProjectCard';
import { useProjectStore } from '../store/projectStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { projects, loading, loadProjects, createProject, deleteProject } = useProjectStore();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [deletingProject, setDeletingProject] = useState(null);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  async function submit(event) {
    event.preventDefault();
    const project = await createProject(form);
    setModal(false);
    setForm({ title: '', description: '' });
    navigate(`/projects/${project.id}/board`);
  }

  return (
    <main className="page-container py-8">
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
              onOpen={() => navigate(project.hasRoadmap ? `/projects/${project.id}/roadmap` : `/projects/${project.id}/board`)}
              onDelete={() => setDeletingProject(project)}
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
      {deletingProject && (
        <DeleteConfirmModal
          title={`Delete "${deletingProject.title}"?`}
          warning={
            <>
              This will also delete its {deletingProject.tasks.length + deletingProject.groups.reduce((sum, g) => sum + g.tasks.length, 0)} task(s),{' '}
              {deletingProject.groups.length} group(s), and any gates or tags -- all in one action.
            </>
          }
          onClose={() => setDeletingProject(null)}
          onConfirm={async () => {
            await deleteProject(deletingProject.id);
            toast.success(`"${deletingProject.title}" deleted. Restore it from Trash within 30 days.`);
            setDeletingProject(null);
          }}
        />
      )}
    </main>
  );
}
