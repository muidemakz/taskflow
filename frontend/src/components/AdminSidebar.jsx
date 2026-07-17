import { BarChart3, ScrollText, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export default function AdminSidebar() {
  const link = ({ isActive }) => `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${isActive ? 'bg-blue-50 text-primary' : 'text-muted hover:bg-white hover:text-text'}`;
  return (
    <aside className="w-full border-b border-border bg-slate-50 p-3 md:min-h-[calc(100vh-61px)] md:w-64 md:border-b-0 md:border-r">
      <nav className="flex gap-2 md:flex-col">
        <NavLink to="/admin" end className={link}><BarChart3 size={17} /> Overview</NavLink>
        <NavLink to="/admin/users" className={link}><Users size={17} /> Users</NavLink>
        <NavLink to="/admin/activity" className={link}><ScrollText size={17} /> Activity</NavLink>
      </nav>
    </aside>
  );
}
