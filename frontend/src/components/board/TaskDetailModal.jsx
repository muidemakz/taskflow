import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileText, Layers, Plus, Star, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import DeleteConfirmModal from '../DeleteConfirmModal';
import TagMultiSelect from '../TagMultiSelect';
import TaskActivityTimeline from './TaskActivityTimeline';
import LinkedDocsPickerModal from './LinkedDocsPickerModal';
import { boardApi, tagsApi, tasksApi, taskDocLinksApi } from '../../api/endpoints';
import { useBoardStore } from '../../store/boardStore';

// statusOptions scopes the dropdown's choices (gate-scoped board vs.
// whole-project board); statuses stays the full project list so the
// current status can always be resolved even if it falls outside that scope.
export default function TaskDetailModal({ task, statuses, statusOptions, gates, tags, onClose, onUpdated }) {
  const navigate = useNavigate();
  const updateTaskFields = useBoardStore((s) => s.updateTaskFields);
  const refreshBoard = useBoardStore((s) => s.refreshBoard);
  const loadProjectMeta = useBoardStore((s) => s.loadProjectMeta);
  const [current, setCurrent] = useState(task);
  const [title, setTitle] = useState(task.title);
  const [comment, setComment] = useState(task.comment || '');
  const [blockedNote, setBlockedNote] = useState(task.blockedNote || '');
  const [roadmapEntries, setRoadmapEntries] = useState([]);
  const [showGatePicker, setShowGatePicker] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState([]);
  const [showDocPicker, setShowDocPicker] = useState(false);

  const options = statusOptions?.length ? statusOptions : statuses;
  // The current status can fall outside a gate-scoped dropdown's options
  // (e.g. a task sitting in "Done" while the gate view only shows statuses
  // its own tasks currently use) -- always include it so the select never
  // silently shows the wrong value.
  const statusSelectOptions = options.some((s) => s.id === current.statusId)
    ? options
    : [...options, ...statuses.filter((s) => s.id === current.statusId)];

  useEffect(() => {
    boardApi.taskRoadmaps(task.id).then(({ data }) => setRoadmapEntries(data.entries));
  }, [task.id]);

  function loadLinkedDocs() {
    taskDocLinksApi.list(current.projectId, task.id).then(({ data }) => setLinkedDocs(data));
  }

  useEffect(() => {
    loadLinkedDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  async function removeDocLink(docId) {
    try {
      await taskDocLinksApi.remove(current.projectId, task.id, docId);
      loadLinkedDocs();
    } catch {
      toast.error('Could not remove link');
    }
  }

  async function patch(payload) {
    try {
      const updated = await updateTaskFields(current.id, payload);
      setCurrent(updated);
      onUpdated?.(updated);
      return updated;
    } catch {
      toast.error('Could not update task');
      return null;
    }
  }

  async function addTag(tagId) {
    await patch({ addTagIds: [tagId] });
  }

  async function removeTag(tagId) {
    await patch({ removeTagIds: [tagId] });
  }

  async function createAndAddTag(name) {
    try {
      const { data: tag } = await tagsApi.create(current.projectId, { name });
      await addTag(tag.id);
      await loadProjectMeta(current.projectId);
    } catch {
      toast.error('Could not create tag');
    }
  }

  async function addGatePlacement(gateId) {
    try {
      await boardApi.addGatePlacement(task.id, gateId);
      const { data } = await boardApi.taskRoadmaps(task.id);
      setRoadmapEntries(data.entries);
      setShowGatePicker(false);
      toast.success('Added to gate');
    } catch {
      toast.error('Could not add to gate');
    }
  }

  async function confirmDeleteTask() {
    try {
      await tasksApi.remove(current.id);
      toast.success('Task deleted. Restore it from Trash within 30 days.');
      onClose();
      refreshBoard();
    } catch {
      toast.error('Could not delete task');
      setDeleting(false);
    }
  }

  const roadmapCount = new Set(roadmapEntries.map((e) => e.roadmapId)).size;
  const placedGateIds = new Set(roadmapEntries.filter((e) => e.relation !== 'taskRoadmap').map((e) => e.gateId));
  const pickableGates = gates.filter((g) => !placedGateIds.has(g.id));

  return (
    <Modal title="Task details" onClose={onClose} maxWidthClass="max-w-2xl">
      <input
        className="field mb-3 border-transparent px-0 text-lg font-semibold focus:px-2"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== current.title && patch({ title: title.trim() })}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {roadmapCount > 1 && (
          <span className="chip bg-purple-50 text-purple-700"><Layers size={11} className="mr-1" />Counts in {roadmapCount} roadmaps</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Status</label>
          <select className="field" value={current.statusId || ''} onChange={(e) => patch({ statusId: e.target.value })}>
            {statusSelectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Gate</label>
          <select
            className="field"
            value={current.gateId || ''}
            onChange={(e) => patch({ gateId: e.target.value || null })}
          >
            <option value="">Unscheduled</option>
            {gates.map((g) => (
              <option key={g.id} value={g.id}>{g.name}{g.status === 'CLOSED' ? ' (Closed)' : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Priority</label>
          <select className="field" value={current.priority || 'NONE'} onChange={(e) => patch({ priority: e.target.value })}>
            <option value="NONE">None</option>
            <option value="LOW">Low</option>
            <option value="MID">Mid</option>
            <option value="HIGH">High</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Due date (optional)</label>
          <div className="flex gap-2">
            <input
              type="date"
              className="field"
              value={current.dueDate ? current.dueDate.slice(0, 10) : ''}
              onChange={(e) => patch({ dueDate: e.target.value || null })}
            />
            {current.dueDate && (
              <button className="btn-ghost" onClick={() => patch({ dueDate: null })}>Clear</button>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Blocked</label>
          <button
            className={`btn-ghost w-full justify-start ${current.blocked ? 'border-red-200 bg-red-50 text-red-700' : ''}`}
            onClick={() => patch({ blocked: !current.blocked })}
          >
            <AlertTriangle size={15} /> {current.blocked ? 'Blocked' : 'Not blocked'}
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Focus</label>
          <button
            className={`btn-ghost w-full justify-start ${current.focus ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}`}
            onClick={() => patch({ focus: !current.focus, ...(current.focus ? { focusTargetDate: null } : {}) })}
          >
            <Star size={15} /> {current.focus ? 'In focus' : 'Not in focus'}
          </button>
        </div>

        {current.focus && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Focus target date (optional)</label>
            <div className="flex gap-2">
              <input
                type="date"
                className="field"
                value={current.focusTargetDate ? current.focusTargetDate.slice(0, 10) : ''}
                onChange={(e) => patch({ focusTargetDate: e.target.value || null })}
              />
              {current.focusTargetDate && (
                <button className="btn-ghost" onClick={() => patch({ focusTargetDate: null })}>Clear</button>
              )}
            </div>
          </div>
        )}
      </div>

      {current.blocked && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Why is it blocked?</label>
          <textarea
            className="field min-h-16"
            value={blockedNote}
            onChange={(e) => setBlockedNote(e.target.value)}
            onBlur={() => patch({ blockedNote })}
          />
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Tags</label>
        <TagMultiSelect
          selectedTags={current.tags || []}
          availableTags={tags}
          onAdd={addTag}
          onRemove={removeTag}
          onCreate={createAndAddTag}
        />
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Comment</label>
        <textarea
          className="field min-h-20"
          placeholder="Add a comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => comment !== (current.comment || '') && patch({ comment })}
        />
      </div>

      {gates.length > 0 && (
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Also placed in</label>
          <div className="flex flex-wrap items-center gap-2">
            {roadmapEntries.filter((e) => e.relation === 'gatePlacement').map((e) => (
              <span key={e.gateId} className="chip bg-purple-50 text-purple-700">{e.gateName}</span>
            ))}
            {!showGatePicker ? (
              <button className="btn-ghost" onClick={() => setShowGatePicker(true)} disabled={!pickableGates.length}>
                <Plus size={14} /> Place in another gate
              </button>
            ) : (
              <select className="field w-auto" defaultValue="" onChange={(e) => e.target.value && addGatePlacement(e.target.value)}>
                <option value="" disabled>Choose a gate...</option>
                {pickableGates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">Status stays shared -- there's no separate status to choose per placement.</p>
        </div>
      )}

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Linked docs</label>
        <div className="flex flex-wrap items-center gap-2">
          {linkedDocs.map((doc) => (
            <span key={doc.id} className="chip gap-1 border border-[#d8e0ea] bg-white text-text">
              <button
                className="flex items-center gap-1 hover:text-primary"
                onClick={() => navigate(`/projects/${current.projectId}/docs/${doc.id}`)}
              >
                <FileText size={11} /> {doc.title}
              </button>
              <button onClick={() => removeDocLink(doc.id)} aria-label={`Remove link to ${doc.title}`} className="text-muted hover:text-red-600">
                <X size={11} />
              </button>
            </span>
          ))}
          <button className="btn-icon h-7 w-7" onClick={() => setShowDocPicker(true)} aria-label="Link a doc">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted">Activity</label>
        <TaskActivityTimeline taskId={current.id} refreshKey={current.updatedAt} />
      </div>

      <div className="mt-6 flex justify-end border-t border-border pt-4">
        <button className="btn-ghost text-red-700 hover:bg-red-50" onClick={() => setDeleting(true)}>
          <Trash2 size={15} /> Delete task
        </button>
      </div>

      {deleting && (
        <DeleteConfirmModal
          title={`Delete "${current.title}"?`}
          warning="This task will be moved to Trash, where it can be restored within 30 days."
          onConfirm={confirmDeleteTask}
          onClose={() => setDeleting(false)}
        />
      )}

      {showDocPicker && (
        <LinkedDocsPickerModal
          projectId={current.projectId}
          taskId={task.id}
          linkedDocIds={linkedDocs.map((d) => d.id)}
          onClose={() => setShowDocPicker(false)}
          onDone={() => { setShowDocPicker(false); loadLinkedDocs(); }}
        />
      )}
    </Modal>
  );
}
