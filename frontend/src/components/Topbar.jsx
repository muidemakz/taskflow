import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Shield, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Topbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/dashboard" className="text-lg font-bold tracking-tight text-primary">Taskflow</Link>
        <div className="flex items-center gap-2">
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
    </header>
  );
}
