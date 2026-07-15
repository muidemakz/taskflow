import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Inbox, ListChecks, LogOut, Shield, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { syncApi } from '../api/endpoints';
import SearchBar from './SearchBar';

export default function Topbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    function refreshPendingCount() {
      syncApi.proposals('PENDING').then(({ data }) => setPendingCount(data.length)).catch(() => {});
    }
    refreshPendingCount();
    window.addEventListener('taskflow:proposals-changed', refreshPendingCount);
    return () => window.removeEventListener('taskflow:proposals-changed', refreshPendingCount);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/dashboard" className="shrink-0 text-lg font-bold tracking-tight text-primary">Taskflow</Link>

        <div className="hidden flex-1 justify-center sm:flex">
          <SearchBar />
        </div>

        <div className="flex items-center gap-2">
          <Link className="btn-icon" to="/my-tasks" aria-label="My Tasks" title="My Tasks">
            <ListChecks size={16} />
          </Link>
          <Link className="btn-icon relative" to="/review" aria-label="Catch-up review queue" title="Catch-up review queue">
            <Inbox size={16} />
            {pendingCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </Link>
          <Link className="btn-icon" to="/trash" aria-label="Trash" title="Trash">
            <Trash2 size={16} />
          </Link>
          {user?.role === 'ADMIN' && (
            <Link className="btn-ghost hidden sm:inline-flex" to="/admin">
              <Shield size={16} /> Admin
            </Link>
          )}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold">{user?.name}</div>
            <div className="text-xs text-muted">{user?.email}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-primary">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <button className="btn-icon" onClick={async () => { await logout(); navigate('/login'); }} aria-label="Logout">
            <LogOut size={17} />
          </button>
        </div>
      </div>
      <div className="border-t border-border px-4 py-2 sm:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
