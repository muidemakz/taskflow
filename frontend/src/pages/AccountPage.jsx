import { useNavigate } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

// Minimal by design -- this page exists so the bottom nav's Account tab has
// somewhere to land (checkpoint c.1.3); it isn't a settings/profile-editing
// surface, just identity + sign-out.
export default function AccountPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-xl font-bold">Account</h1>

      <div className="card mt-4 flex items-center gap-3 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-primary">
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{user?.name}</p>
          <p className="truncate text-sm text-muted">{user?.email}</p>
        </div>
      </div>

      {user?.role === 'ADMIN' && (
        <button className="btn-ghost mt-3 w-full justify-center" onClick={() => navigate('/admin')}>
          <Shield size={16} /> Admin dashboard
        </button>
      )}

      <button
        className="btn-ghost mt-3 w-full justify-center text-red-600"
        onClick={async () => { await logout(); navigate('/login'); }}
      >
        <LogOut size={16} /> Log out
      </button>
    </main>
  );
}
