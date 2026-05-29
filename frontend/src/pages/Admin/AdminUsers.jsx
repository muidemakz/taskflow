import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/endpoints';
import Modal from '../../components/Modal';
import { formatDate } from '../../utils/project';

export default function AdminUsers() {
  const [payload, setPayload] = useState({ users: [], page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null);
  const [page, setPage] = useState(1);
  const load = () => adminApi.users({ search, page }).then(({ data }) => setPayload(data));
  useEffect(() => { load(); }, [page]);

  async function saveEdit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await adminApi.updateUser(edit.id, Object.fromEntries(form));
    toast.success('User updated');
    setEdit(null);
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); load(); }}>
          <input className="field w-64" placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-ghost">Search</button>
        </form>
      </div>
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
                      <button className="btn-ghost py-1 text-red-700" onClick={async () => { if (confirm(`Delete ${user.email}?`)) { await adminApi.deleteUser(user.id); toast.success('User deleted'); load(); } }}>Delete</button>
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
            <input name="name" className="field" defaultValue={edit.name} />
            <input name="email" className="field" defaultValue={edit.email} />
            <select name="role" className="field" defaultValue={edit.role}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary">Save</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
