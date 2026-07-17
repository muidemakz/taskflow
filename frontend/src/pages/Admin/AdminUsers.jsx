import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/endpoints';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/project';

export default function AdminUsers() {
  const [payload, setPayload] = useState({ users: [], page: 1, pages: 1, total: 0 });
  const [invites, setInvites] = useState([]);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null);
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = () => adminApi.users({ search, page }).then(({ data }) => setPayload(data));
  const loadInvites = () => adminApi.invites().then(({ data }) => setInvites(data));
  useEffect(() => { load(); }, [page]);
  useEffect(() => { loadInvites(); }, []);

  async function saveEdit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form);
    if (!payload.password) delete payload.password;
    try {
      await adminApi.updateUser(edit.id, payload);
      toast.success('User updated');
      setEdit(null);
      load();
    } catch {
      // client.js interceptor already toasts the server's message
      // (e.g. "Cannot remove admin role from the last remaining admin")
    }
  }

  async function revokeInvite(id) {
    await adminApi.revokeInvite(id);
    toast.success('Invite revoked');
    loadInvites();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex gap-2">
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); load(); }}>
            <input className="field w-64" placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn-ghost">Search</button>
          </form>
          <button className="btn-primary" onClick={() => setInviteOpen(true)}><UserPlus size={16} /> Invite user</button>
        </div>
      </div>

      {invites.length > 0 && (
        <section className="card mt-5 p-4">
          <h2 className="font-semibold">Pending invites</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {invites.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium">{invite.email} <span className="chip ml-1 bg-slate-100 text-muted">{invite.role}</span></p>
                  <p className="text-xs text-muted">Invited by {invite.invitedByName} · expires {formatDate(invite.expiresAt)}</p>
                </div>
                <button className="btn-ghost py-1 text-red-700" onClick={() => revokeInvite(invite.id)}>Revoke</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-muted"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Projects</th><th className="p-3">Tasks</th><th className="p-3">Joined</th><th className="p-3">Last login</th><th className="p-3">Actions</th></tr></thead>
            <tbody>
              {payload.users.map((user) => (
                <tr className="border-t border-slate-100" key={user.id}>
                  <td className="p-3 font-semibold">{user.name}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3"><span className={`chip ${user.role === 'ADMIN' ? 'bg-blue-50 text-primary' : 'bg-slate-100 text-muted'}`}>{user.role}</span></td>
                  <td className="p-3">{user.projectsCount}</td>
                  <td className="p-3">{user.tasksCount}</td>
                  <td className="p-3">{formatDate(user.createdAt)}</td>
                  <td className="p-3">{formatDate(user.lastLoginAt)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Link className="btn-ghost py-1" to={`/admin/users/${user.id}`}>View</Link>
                      <button className="btn-ghost py-1" onClick={() => setEdit(user)}>Edit</button>
                      <button className="btn-ghost py-1 text-red-700" onClick={async () => { if (confirm(`Delete ${user.email}?`)) { try { await adminApi.deleteUser(user.id); toast.success('User deleted'); load(); } catch {} } }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="text-sm text-muted">Page {payload.page} of {payload.pages || 1}</span>
        <button className="btn-ghost" disabled={page >= payload.pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
      {edit && (
        <Modal title="Edit user" onClose={() => setEdit(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted">Name</label>
              <input name="name" className="field mt-1" defaultValue={edit.name} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted">Email</label>
              <input name="email" className="field mt-1" defaultValue={edit.email} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted">Role</label>
              <select name="role" className="field mt-1" defaultValue={edit.role}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted">Reset password (optional)</label>
              <input name="password" type="password" className="field mt-1" placeholder="Leave blank to keep current password" minLength={8} />
            </div>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary">Save</button></div>
          </form>
        </Modal>
      )}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onCreated={loadInvites} />}
    </div>
  );
}

function InviteModal({ onClose, onCreated }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('USER');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  async function create(event) {
    event.preventDefault();
    setCreating(true);
    try {
      const { data } = await adminApi.createInvite({ email: email.trim(), role });
      setCreated(data);
      onCreated();
    } catch {
      // interceptor toasts the server message (already exists / already invited)
    } finally {
      setCreating(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(created.inviteUrl);
    setCopied(true);
    toast.success('Copied to clipboard');
  }

  return (
    <Modal title={created ? 'Invite created' : 'Invite a user'} onClose={onClose}>
      {!created ? (
        <form onSubmit={create} className="space-y-3">
          <p className="text-sm text-muted">There's no email sending in this app yet -- you'll get a link to share directly with the invitee.</p>
          <div>
            <label className="block text-xs font-semibold text-muted">Email</label>
            <input type="email" required className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted">Role</label>
            <select className="field mt-1" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <button className="btn-primary w-full justify-center" disabled={creating || !email.trim()}>
            {creating ? 'Creating…' : 'Create invite'}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Share this link with {created.email} -- it expires in 7 days.</p>
          <div className="flex items-center gap-2 rounded-md border border-[#d8e0ea] bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
            <code className="min-w-0 flex-1 truncate text-xs">{created.inviteUrl}</code>
            <button className="btn-icon shrink-0" onClick={copy} aria-label="Copy invite link">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <button className="btn-ghost w-full justify-center" onClick={onClose}>Done</button>
        </div>
      )}
    </Modal>
  );
}
