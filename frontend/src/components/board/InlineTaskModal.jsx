import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import TaskDetailModal from './TaskDetailModal';
import { boardApi, projectsApi, roadmapApi, statusesApi, tagsApi } from '../../api/endpoints';

// Opens TaskDetailModal from pages that aren't the project board (My Tasks,
// search results) so the user keeps their place instead of being navigated
// to /board?taskId=X. The board page feeds the modal from the board store;
// here the project context is fetched ad hoc and kept in local state -- it
// must NOT go through the store, because the search bar is mounted on every
// page (including other projects' boards) and loading another project's
// meta into the store would corrupt the board currently on screen.
export default function InlineTaskModal({ projectId, taskId, onClose, onUpdated }) {
  const [context, setContext] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      boardApi.get(projectId),
      statusesApi.list(projectId),
      roadmapApi.get(projectId),
      tagsApi.list(projectId),
      projectsApi.detail(projectId)
    ])
      .then(([board, statuses, roadmap, tags, project]) => {
        if (cancelled) return;
        const task = board.data.columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
        if (!task) {
          toast.error('Could not open that task');
          onClose();
          return;
        }
        setContext({
          task,
          statuses: statuses.data,
          gates: roadmap.data.gates || [],
          tags: tags.data,
          promptRulesCategoryId: project.data.promptRulesCategoryId
        });
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Could not open that task');
          onClose();
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, taskId]);

  if (!context) {
    return (
      <Modal title="Task details" onClose={onClose} maxWidthClass="max-w-2xl">
        <p className="py-6 text-center text-sm text-muted">Loading task…</p>
      </Modal>
    );
  }

  return (
    <TaskDetailModal
      task={context.task}
      statuses={context.statuses}
      statusOptions={context.statuses}
      gates={context.gates}
      tags={context.tags}
      promptRulesCategoryId={context.promptRulesCategoryId}
      onClose={onClose}
      onUpdated={onUpdated}
    />
  );
}
