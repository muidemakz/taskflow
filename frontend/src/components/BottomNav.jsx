import { Link, useLocation } from 'react-router-dom';
import { CheckSquare, Inbox, LayoutGrid, Trash2, User } from 'lucide-react';

const TABS = [
  { to: '/my-tasks', label: 'My Tasks', icon: CheckSquare },
  { to: '/review', label: 'Catch Up', icon: Inbox },
  { to: '/dashboard', label: 'Projects', icon: LayoutGrid },
  { to: '/trash', label: 'Trash', icon: Trash2 },
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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl">
        {TABS.map((tab) => {
          const active = isTabActive(tab, pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition ${
                active ? 'text-primary' : 'text-muted hover:text-slate-700'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
