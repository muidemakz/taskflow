import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import SearchBar from './SearchBar';

export default function Topbar() {
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/dashboard" className="shrink-0 text-lg font-bold tracking-tight text-primary">Taskflow</Link>

        <div className="hidden flex-1 justify-center sm:flex">
          <SearchBar />
        </div>

        <div className="flex items-center gap-2">
          {user?.role === 'ADMIN' && (
            <Link className="btn-ghost hidden sm:inline-flex" to="/admin">
              <Shield size={16} /> Admin
            </Link>
          )}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold">{user?.name}</div>
            <div className="text-xs text-muted">{user?.email}</div>
          </div>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-primary dark:bg-blue-950 dark:text-blue-300">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border px-4 py-2 sm:hidden dark:border-slate-700">
        <SearchBar />
      </div>
    </header>
  );
}
