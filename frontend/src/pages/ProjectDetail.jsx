import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, FolderPlus, LayoutGrid, Plus, Share2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import GroupCard from '../components/GroupCard';
import ProjectTabs from '../components/ProjectTabs';
import SharedFilterBar from '../components/SharedFilterBar';
import Modal from '../components/Modal';
import ShareProjectModal from '../components/ShareProjectModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import ProgressBar from '../components/ProgressBar';
import TaskCard from '../components/TaskCard';
import { useProjectStore } from '../store/projectStore';
import { stats, visibleEntries } from '../utils/project';

function SortableEntry({ id, children, disabled }) {
  const sortable = useSortable({ id, disabled });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return <div ref={sortable.setNodeRef} style={style}>{children(sortable)}</div>;
}

const filtersInitial = { query: '', status: 'all', completedAfter: '', sort: 'default' };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useProjectStore();
  const { current: project, loading } = store;
  const [filters, setFilters] = useState(filtersInitial);
  const [mergeMode, setMergeMode] = useState(false);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [mergeModal, setMergeModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  useEffect(() => { store.loadProject(id); }, [id]);
  const st = stats(project);
  const entries = useMemo(() => (project ? visibleEntries(project, filters) : []), [project, filters]);

  function optimisticToggle(taskId, payload) {
    if (!project || !payload.status) return null;
    const clone = structuredClone(project);
    const all = [...clone.tasks, ...clone.groups.flatMap((group) => group.tasks)];
    const task = all.find((item) => item.id === taskId);
    if (task) {
      task.status = payload.status;
      task.completedAt = payload.status === 'DONE' ? new Date().toISOString() : null;
    }
    return clone;
  }

  async function handleTaskUpdate(taskId, payload) {
    const optimistic = optimisticToggle(taskId, payload);
    await store.updateTask(taskId, payload, optimistic);
  }

  async function reorder(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || !project) return;
    const oldIndex = project.order.indexOf(active.id);
    const newIndex = project.order.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    await store.updateProject(project.id, { order: arrayMove(project.order, oldIndex, newIndex) });
  }

  async function addTask(groupId = null, title = 'New Task') {
    await store.createTask({ title, groupId });
  }

  if (loading || !project) return <main className="p-8 text-center text-muted">Loading project...</main>;

  return (
    <main>
      <div className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button className="btn-icon" onClick={() => navigate('/dashboard')}><ArrowLeft size={17} /></button>
            <input className="field max-w-lg border-transparent text-base font-semibold" value={project.title} onChange={(e) => store.applyProject({ ...project, title: e.target.value })} onBlur={(e) => store.updateProject(project.id, { title: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => navigate(project.hasRoadmap ? `/projects/${project.id}/roadmap` : `/projects/${project.id}/board`)}>
              <LayoutGrid size={16} /> {project.hasRoadmap ? 'Roadmap' : 'Board'}
            </button>
            <button className="btn-ghost" onClick={() => addTask()}><Plus size={16} /> Add Task</button>
            <button className="btn-ghost" onClick={() => store.createGroup('New Group')}><FolderPlus size={16} /> Add Group</button>
            <button className="btn-ghost" onClick={() => setArrangeMode(!arrangeMode)}>{arrangeMode ? 'Done arranging' : 'Arrange'}</button>
            <button className="btn-ghost" onClick={() => { setMergeMode(!mergeMode); setSelectedGroups([]); }}>Merge Groups</button>
            <button className="btn-ghost" onClick={() => setShareModal(true)}><Share2 size={16} /> Share</button>
            <button className="btn-icon text-red-700 hover:bg-red-50" onClick={() => setDeletingProject(true)}><Trash2 size={16} /></button>
          </div>
        </div>
      </div>

      <ProjectTabs projectId={id} active="tasks" tasksTo={`/projects/${id}/legacy`} />

      <section className="border-b border-border bg-white/80 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1"><ProgressBar value={st.pct} /></div>
            <span className="text-sm text-muted">{st.done} of {st.total} done · <strong>{st.pct}%</strong></span>
          </div>
          <SharedFilterBar
            filters={filters}
            onChange={setFilters}
            onClear={() => setFilters(filtersInitial)}
            placeholder="Search tasks or comments..."
            filterFields={[
              {
                key: 'status',
                render: (f, set) => (
                  <div className="rounded-md border border-border bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
                    {['all', 'TODO', 'DONE'].map((value) => (
                      <button
                        key={value}
                        className={`rounded px-3 py-1.5 text-sm font-semibold ${f.status === value ? 'bg-primary text-white' : 'text-muted dark:text-slate-400'}`}
                        onClick={() => set({ status: value })}
                      >
                        {value === 'all' ? 'All' : value === 'TODO' ? 'To-do' : 'Done'}
                      </button>
                    ))}
                  </div>
                )
              },
              {
                key: 'completedAfter',
                render: (f, set) => (
                  <input
                    className="field w-auto dark:bg-slate-800 dark:text-white dark:border-slate-700"
                    type="date"
                    value={f.completedAfter}
                    onChange={(e) => set({ completedAfter: e.target.value })}
                    aria-label="Completed after date"
                  />
                )
              },
              {
                key: 'sort',
                render: (f, set) => (
                  <select
                    className="field w-auto dark:bg-slate-800 dark:text-white dark:border-slate-700"
                    value={f.sort}
                    onChange={(e) => set({ sort: e.target.value })}
                  >
                    <option value="default">Default order</option>
                    <option value="todo-first">To-do first</option>
                    <option value="done-first">Completed first</option>
                    <option value="completed-desc">Newest completed</option>
                    <option value="completed-asc">Oldest completed</option>
                  </select>
                )
              }
            ]}
          />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-5">
        {mergeMode && (
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
            <span className="text-sm text-muted"><strong>{selectedGroups.length}</strong> groups selected. Select at least two groups.</span>
            <button className="btn-primary" disabled={selectedGroups.length < 2} onClick={() => setMergeModal(true)}>Merge selected</button>
          </div>
        )}
        <DndContext collisionDetection={closestCenter} onDragEnd={reorder}>
          <SortableContext items={project.order || []} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {entries.map((entry) => (
                <SortableEntry key={entry.key} id={entry.key} disabled={!arrangeMode}>
                  {(sortable) => entry.type === 'task' ? (
                    <TaskCard task={entry.item} groups={project.groups} onUpdate={handleTaskUpdate} onDelete={setDeletingTaskId} onMove={(tid, gid) => store.moveTask(tid, gid)} dragHandle={{ ...sortable.attributes, ...sortable.listeners }} />
                  ) : (
                    <GroupCard
                      group={{ ...entry.item, tasks: entry.tasks }}
                      groups={project.groups}
                      selectable={mergeMode}
                      selected={selectedGroups.includes(entry.item.id)}
                      onSelect={(gid) => setSelectedGroups((items) => items.includes(gid) ? items.filter((item) => item !== gid) : [...items, gid])}
                      onRename={(gid, title) => store.updateGroup(gid, { title })}
                      onDelete={(gid) => confirm('Delete this group and its tasks?') && store.deleteGroup(gid)}
                      onUngroup={(gid) => confirm('Ungroup this group?') && store.ungroup(gid)}
                      onAddTask={addTask}
                      onTaskUpdate={handleTaskUpdate}
                      onTaskDelete={setDeletingTaskId}
                      onTaskMove={(tid, gid) => store.moveTask(tid, gid)}
                    />
                  )}
                </SortableEntry>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="card mt-4 flex gap-2 p-3">
          <input id="new-group-task" className="field" placeholder="Add a task to the top of this project" onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { addTask(null, e.currentTarget.value.trim()); e.currentTarget.value = ''; } }} />
          <button className="btn-primary" onClick={() => { const input = document.getElementById('new-group-task'); if (input.value.trim()) { addTask(null, input.value.trim()); input.value = ''; } }}>Add</button>
        </div>
      </section>

      {mergeModal && (
        <Modal title="Merge selected groups" onClose={() => setMergeModal(false)}>
          <p className="mb-4 text-sm text-muted">All selected groups will become one group. Their tasks will be kept and combined.</p>
          <input id="merge-name" className="field" defaultValue="Merged group" />
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setMergeModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={async () => { await store.mergeGroups({ groupIds: selectedGroups, title: document.getElementById('merge-name').value }); setMergeModal(false); setMergeMode(false); setSelectedGroups([]); }}>Merge all</button>
          </div>
        </Modal>
      )}

      {shareModal && (
        <ShareProjectModal
          project={project}
          onToggleShare={async (enabled) => { await store.toggleShare(enabled); }}
          onClose={() => setShareModal(false)}
        />
      )}

      {deletingProject && (
        <DeleteConfirmModal
          title={`Delete "${project.title}"?`}
          warning={
            <>
              This will also delete its {project.tasks.length + project.groups.reduce((sum, g) => sum + g.tasks.length, 0)} task(s),{' '}
              {project.groups.length} group(s), and any gates or tags -- all in one action.
            </>
          }
          onClose={() => setDeletingProject(false)}
          onConfirm={async () => {
            await store.deleteProject(project.id);
            toast.success(`"${project.title}" deleted. Restore it from Trash within 30 days.`);
            navigate('/dashboard');
          }}
        />
      )}

      {deletingTaskId && (
        <DeleteConfirmModal
          title="Delete this task?"
          warning="This task will be moved to Trash, where it can be restored within 30 days."
          onClose={() => setDeletingTaskId(null)}
          onConfirm={async () => {
            await store.deleteTask(deletingTaskId);
            toast.success('Task deleted. Restore it from Trash within 30 days.');
            setDeletingTaskId(null);
          }}
        />
      )}
    </main>
  );
}
