import { ChevronDown, Folder, GripVertical, Trash2, Ungroup } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import TaskCard from './TaskCard';

export default function GroupCard({ group, groups, readOnly = false, selectable = false, selected = false, onSelect, onRename, onDelete, onUngroup, onAddTask, onTaskUpdate, onTaskDelete, onTaskMove }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(group.title);
  useEffect(() => setTitle(group.title), [group.id, group.title]);
  const counts = useMemo(() => {
    const total = group.tasks?.length || 0;
    const done = (group.tasks || []).filter((task) => task.status === 'DONE').length;
    return { total, done };
  }, [group.tasks]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 p-3">
        {selectable && <input type="checkbox" checked={selected} onChange={() => onSelect?.(group.id)} className="h-4 w-4" />}
        {!readOnly && <GripVertical size={16} className="text-slate-400" />}
        <button className="btn-icon h-8 w-8" onClick={() => setOpen((value) => !value)}>
          <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
        </button>
        <input className="field border-transparent font-semibold" value={title} readOnly={readOnly} onChange={(event) => setTitle(event.target.value)} onBlur={(event) => onRename?.(group.id, event.target.value.trim() || group.title)} />
        <span className="chip bg-blue-50 text-primary"><Folder size={13} className="mr-1" /> Group</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-muted">{counts.done}/{counts.total}</span>
        {!readOnly && (
          <>
            <button className="btn-icon" onClick={() => onUngroup?.(group.id)} title="Ungroup"><Ungroup size={16} /></button>
            <button className="btn-icon text-red-700 hover:bg-red-50" onClick={() => onDelete?.(group.id)} title="Delete group"><Trash2 size={16} /></button>
          </>
        )}
      </div>
      {open && (
        <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 p-3">
          {!group.tasks?.length && <p className="text-sm text-muted">No tasks in this group yet.</p>}
          {(group.tasks || []).map((task) => (
            <TaskCard key={task.id} task={task} groups={groups} groupId={group.id} readOnly={readOnly} onUpdate={onTaskUpdate} onDelete={onTaskDelete} onMove={onTaskMove} />
          ))}
          {!readOnly && (
            <div className="flex gap-2 pt-1">
              <input className="field" placeholder="New task..." onKeyDown={(event) => {
                if (event.key === 'Enter' && event.currentTarget.value.trim()) {
                  onAddTask?.(group.id, event.currentTarget.value.trim());
                  event.currentTarget.value = '';
                }
              }} />
              <button className="btn-primary" onClick={(event) => {
                const input = event.currentTarget.previousElementSibling;
                if (input.value.trim()) {
                  onAddTask?.(group.id, input.value.trim());
                  input.value = '';
                }
              }}>Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
