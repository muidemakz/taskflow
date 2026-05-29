import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi } from '../../api/endpoints';
import ProgressBar from '../../components/ProgressBar';
import { formatDate } from '../../utils/project';

export default function AdminUserDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  useEffect(() => { adminApi.user(id).then(({ data }) => setUser(data)); }, [id]);
  if (!user) return <div className="text-muted">Loading user...</div>;
  return (
    <div>
      <h1 className="text-2xl font-bold">{user.name}</h1>
      <section className="card mt-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-sm text-muted">Email</p><p className="font-semibold">{user.email}</p></div>
          <div><p className="text-sm text-muted">Role</p><p className="font-semibold">{user.role}</p></div>
          <div><p className="text-sm text-muted">Joined</p><p className="font-semibold">{formatDate(user.createdAt)}</p></div>
          <div><p className="text-sm text-muted">Last login</p><p className="font-semibold">{formatDate(user.lastLoginAt)}</p></div>
        </div>
      </section>
      <h2 className="mt-7 text-lg font-semibold">Projects</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {user.projects.map((project) => (
          <div className="card p-4" key={project.id}>
            <div className="flex items-start justify-between">
              <div><h3 className="font-semibold">{project.title}</h3><p className="text-sm text-muted">{project.shareEnabled ? 'Shared' : 'Private'}</p></div>
              <span className="chip bg-blue-50 text-primary">{project.stats.done}/{project.stats.total}</span>
            </div>
            <div className="mt-4"><ProgressBar value={project.stats.pct} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
