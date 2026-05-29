import { Check, GripVertical, MessageSquare, MoveRight, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDate } from '../utils/project';

const priorityClass = {
  NONE: 'bg-slate-50 text-muted',
  LOW: 'bg-emerald-50 text-emerald-700',
  MID: 'bg-amber-50 text-amber-700',
  HIGH: 'bg-red-50 text-red-700'
};

export default function TaskCard({ task, groups = [], groupId = null, readOnly = false, onUpdate, onDelete, onMove, dragHandle }) {
  const [showComment, setShowComment] = useState(Boolean(task.comment));
  const [title, setTitle] = useState(task.title);
  const [comment, setComment] = useState(task.comment || '');
  const done = task.status === 'DONE';
  const update = (payload) => onUpdate?.(task.id, payload);
  useEffect(() => { setTitle(task.title); setComment(task.comment || ''); }, [task.id, task.title, task.comment]);

  return (
    <div className={`rounded-lg border bg-white p-3 shadow-sm transition ${done ? 'border-emerald-100' : 'border-[#d8e0ea]'} focus-within:border-primary focus-within:ring-2 focus-within:ring-blue-100`}>
      <div className="flex items-start gap-3">
        {!readOnly && <span className="mt-2 cursor-grab text-slate-400" {...dragHandle}><GripVertical size={16} /></span>}
        <div className="min-w-0 flex-1">
          <input
            className={`field border-transparent px-0 py-1 focus:px-2 ${done ? 'text-muted line-through' : ''}`}
            value={title}
            readOnly={readOnly}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={(event) => update({ title: event.target.value.trim() || task.title })}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`chip ${done ? 'bg-[#eaf8ef] text-success' : 'bg-[#eef2f7] text-muted'}`}>{done ? 'Done' : 'To-do'}</span>
            <select
              disabled={readOnly}
              value={task.priority || 'NONE'}
              onChange={(event) => update({ priority: event.target.value })}
              className={`rounded-full border border-transparent px-2 py-1 text-xs font-semibold outline-none ${priorityClass[task.priority || 'NONE']}`}
            >
              <option value="NONE">Priority</option>
              <option value="LOW">Low</option>
              <option value="MID">Mid</option>
              <option value="HIGH">High</option>
            </select>
            {done && <span className="text-xs text-muted">Completed {formatDate(task.completedAt)}</span>}
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap justify-end gap-1">
            <button className="btn-icon" onClick={() => setShowComment((value) => !value)} title="Comment"><MessageSquare size={16} /></button>
            <select className="field w-36 py-1 text-xs" value={groupId || ''} onChange={(event) => onMove?.(task.id, event.target.value || null)} title="Move task">
              <option value="">Direct task</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}
            </select>
            <button className="btn-icon" onClick={() => onMove?.(task.id, null)} title="Move to project root"><MoveRight size={16} /></button>
            <button className="btn-icon text-red-700 hover:bg-red-50" onClick={() => onDelete?.(task.id)} title="Delete task"><Trash2 size={16} /></button>
          </div>
        )}
        <button
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${done ? 'border-success bg-success text-white' : 'border-[#c8d3e1] bg-white text-transparent'} ${readOnly ? 'pointer-events-none' : ''}`}
          onClick={() => update({ status: done ? 'TODO' : 'DONE' })}
          aria-label="Toggle task"
        >
          <Check size={16} />
        </button>
      </div>
      {showComment && (
        <textarea
          className="field mt-3 min-h-20"
          placeholder="Add a comment..."
          value={comment}
          readOnly={readOnly}
          onChange={(event) => setComment(event.target.value)}
          onBlur={(event) => update({ comment: event.target.value })}
        />
      )}
    </div>
  );
}
