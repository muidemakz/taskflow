import {
  AlertTriangle, ArrowRightLeft, CheckCircle2, Clock, DoorClosed, DoorOpen, Flag, MessageSquare, Star, Tag as TagIcon
} from 'lucide-react';

const EVENT_META = {
  status_changed: { icon: CheckCircle2, label: (e) => `Status changed: ${e.oldValue ?? 'none'} → ${e.newValue ?? 'none'}` },
  gate_changed: { icon: ArrowRightLeft, label: (e) => `Moved from ${e.oldValue ?? 'Unscheduled'} to ${e.newValue ?? 'Unscheduled'}` },
  gate_assigned: { icon: ArrowRightLeft, label: (e) => `Assigned to gate ${e.newValue}` },
  gate_removed: { icon: ArrowRightLeft, label: (e) => `Removed from gate ${e.oldValue}` },
  focus_toggled: { icon: Star, label: (e) => `Focus turned ${e.newValue}` },
  due_date_set: { icon: Clock, label: (e) => (e.newValue ? `Due date set to ${e.newValue}` : 'Due date cleared') },
  priority_changed: { icon: Flag, label: (e) => `Priority changed: ${e.oldValue ?? 'None'} → ${e.newValue}` },
  blocked: { icon: AlertTriangle, label: (e) => `Marked as ${e.newValue}` },
  tag_added: { icon: TagIcon, label: (e) => `Tag added: ${e.newValue}` },
  tag_removed: { icon: TagIcon, label: (e) => `Tag removed: ${e.oldValue}` },
  comment_added: { icon: MessageSquare, label: () => 'Comment updated' },
  moved_by_sync_proposal: { icon: CheckCircle2, label: (e) => `Status changed via sync: ${e.oldValue ?? 'none'} → ${e.newValue}` },
  closed_gate_reason: { icon: DoorClosed, label: () => 'Closed gate' },
  reopened_gate_reason: { icon: DoorOpen, label: () => 'Reopened gate' }
};

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// Pure presentational rendering of a TaskActivity list -- shared by the
// authenticated TaskActivityTimeline (which fetches its own entries) and
// the public ShareView task view (which already has entries inline in its
// share payload), so the 14-event-type label mapping lives in exactly one
// place.
export default function ActivityTimelineList({ entries }) {
  if (!entries.length) return <p className="text-sm text-muted">No activity yet.</p>;

  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const meta = EVENT_META[entry.eventType] || { icon: Clock, label: () => entry.eventType };
        const Icon = meta.icon;
        return (
          <li key={entry.id} className="flex gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Icon size={13} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{meta.label(entry)}</p>
              {entry.reason && <p className="mt-0.5 text-xs italic text-muted">&ldquo;{entry.reason}&rdquo;</p>}
              <p className="mt-0.5 text-xs text-muted">
                {formatTimestamp(entry.changedAt)}
                {entry.changedBy?.name ? ` · ${entry.changedBy.name}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
