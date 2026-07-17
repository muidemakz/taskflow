import { useEffect, useState } from 'react';
import { adminApi } from '../../api/endpoints';
import { formatDate } from '../../utils/project';

const EVENT_LABELS = {
  user_invited: 'Invited user',
  user_invite_revoked: 'Revoked invite',
  user_role_changed: 'Changed role',
  user_email_changed: 'Changed email',
  user_password_reset: 'Reset password',
  user_deleted: 'Deleted user'
};

function describe(entry) {
  const target = entry.targetUser?.email || entry.targetUser?.name;
  switch (entry.eventType) {
    case 'user_invited':
      return `invited ${entry.newValue}`;
    case 'user_invite_revoked':
      return `revoked the invite for ${entry.oldValue}`;
    case 'user_role_changed':
      return `changed ${target || 'a user'}'s role from ${entry.oldValue} to ${entry.newValue}`;
    case 'user_email_changed':
      return `changed ${target || 'a user'}'s email from ${entry.oldValue} to ${entry.newValue}`;
    case 'user_password_reset':
      return `reset ${target || 'a user'}'s password`;
    case 'user_deleted':
      return `deleted the account ${entry.oldValue}`;
    default:
      return entry.eventType;
  }
}

export default function AdminActivity() {
  const [payload, setPayload] = useState({ entries: [], page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);

  useEffect(() => { adminApi.activity({ page }).then(({ data }) => setPayload(data)); }, [page]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin activity</h1>
      <p className="mt-1 text-sm text-muted">Audit trail of admin actions -- invites, role changes, password resets, deletions.</p>

      <section className="card mt-5 divide-y divide-slate-100">
        {payload.entries.length === 0 && <p className="p-6 text-center text-muted">No admin activity yet.</p>}
        {payload.entries.map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-semibold">{entry.actor.name}</span>{' '}
                <span className="chip mr-1 bg-slate-100 text-muted">{EVENT_LABELS[entry.eventType] || entry.eventType}</span>
                {describe(entry)}
              </p>
              <p className="mt-0.5 text-xs text-muted">{formatDate(entry.createdAt)}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="text-sm text-muted">Page {payload.page} of {payload.pages || 1}</span>
        <button className="btn-ghost" disabled={page >= payload.pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
