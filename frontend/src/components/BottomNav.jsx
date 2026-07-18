import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckSquare, Inbox, LayoutGrid, StickyNote, User } from 'lucide-react';
import { syncApi } from '../api/endpoints';

const TABS = [
  { to: '/my-tasks', label: 'My Tasks', icon: CheckSquare },
  { to: '/review', label: 'Catch Up', icon: Inbox },
  { to: '/dashboard', label: 'Projects', icon: LayoutGrid },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/account', label: 'Account', icon: User }
];

// Projects also lights up inside a project (board/roadmap/docs) since
// those pages are conceptually still "within" the projects list, not a
// separate section of the app.
function isTabActive(tab, pathname) {
  if (tab.to === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/projects');
  return pathname.startsWith(tab.to);
}

export default function BottomNav() {
  const { pathname } = useLocation();
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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-6xl">
        {TABS.map((tab) => {
          const active = isTabActive(tab, pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                active ? 'text-primary' : 'text-muted hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="relative">
                <Icon size={18} />
                {tab.to === '/review' && pendingCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                )}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
