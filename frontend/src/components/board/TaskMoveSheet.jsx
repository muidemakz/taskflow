import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBoardStore } from '../../store/boardStore';
import { appendPosition } from '../../utils/board';

// Mobile primary interaction: tap a card's move button to open this sheet
// and pick a target status/gate, instead of dragging.
export default function TaskMoveSheet({ task, statuses, gates, onClose }) {
  const moveTask = useBoardStore((s) => s.moveTask);
  const updateTaskFields = useBoardStore((s) => s.updateTaskFields);

  async function moveToStatus(status) {
    if (status.id === task.statusId) return onClose();
    const targetTasks = useBoardStore.getState().columns.find((c) => c.status.id === status.id)?.tasks || [];
    const last = targetTasks[targetTasks.length - 1];
    try {
      await moveTask(task.id, { statusId: status.id, position: appendPosition(last?.position ?? null) });
      toast.success(`Moved to ${status.name}`);
    } catch {
      toast.error('Could not move task');
    }
    onClose();
  }

  async function moveToGate(gate) {
    if ((gate?.id ?? null) === (task.gateId ?? null)) return onClose();
    try {
      await updateTaskFields(task.id, { gateId: gate?.id ?? null });
      toast.success(gate ? `Moved to ${gate.name}` : 'Moved to Unscheduled');
    } catch {
      toast.error('Could not move task');
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-xl bg-white p-4 sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate text-sm font-semibold">Move &ldquo;{task.title}&rdquo;</h3>
          <button className="btn-icon shrink-0" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {statuses.map((status) => (
            <button
              key={status.id}
              className={`btn-ghost justify-start ${status.id === task.statusId ? 'border-primary text-primary' : ''}`}
              onClick={() => moveToStatus(status)}
            >
              {status.name}
            </button>
          ))}
        </div>

        {gates.length > 0 && (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Gate</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`btn-ghost justify-start ${!task.gateId ? 'border-primary text-primary' : ''}`}
                onClick={() => moveToGate(null)}
              >
                Unscheduled
              </button>
              {gates.map((gate) => (
                <button
                  key={gate.id}
                  className={`btn-ghost justify-start ${gate.id === task.gateId ? 'border-primary text-primary' : ''}`}
                  onClick={() => moveToGate(gate)}
                >
                  {gate.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
