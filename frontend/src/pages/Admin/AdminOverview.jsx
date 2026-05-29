import { useEffect, useState } from 'react';
import { adminApi } from '../../api/endpoints';
import { formatDate } from '../../utils/project';

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  useEffect(() => { adminApi.stats().then(({ data }) => setStats(data)); }, []);
  if (!stats) return <div className="text-muted">Loading admin stats...</div>;
  const cards = [
    ['Total Users', stats.users],
    ['Total Projects', stats.projects],
    ['Total Tasks', stats.tasks],
    ['Tasks Completed', `${stats.completed} (${stats.completedPct}%)`],
    ['Users This Month', stats.usersThisMonth],
    ['Projects This Month', stats.projectsThisMonth]
  ];
  return (
    <div>
      <h1 className="text-2xl font-bold">Admin Overview</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <div className="card p-4" key={label}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Recent registrations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-muted"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Joined</th></tr></thead>
            <tbody>
              {stats.recentUsers.map((user) => <tr className="border-t border-slate-100" key={user.id}><td className="p-3 font-semibold">{user.name}</td><td className="p-3">{user.email}</td><td className="p-3">{user.role}</td><td className="p-3">{formatDate(user.createdAt)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
