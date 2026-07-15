import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Topbar from './components/Topbar';
import { useAuthStore } from './store/authStore';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import ProjectBoard from './pages/ProjectBoard';
import RoadmapOverview from './pages/RoadmapOverview';
import ProjectSettings from './pages/ProjectSettings';
import Trash from './pages/Trash';
import MyTasks from './pages/MyTasks';
import CatchUp from './pages/CatchUp';
import ShareView from './pages/ShareView';
import AdminLayout from './pages/Admin/AdminLayout';
import AdminOverview from './pages/Admin/AdminOverview';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminUserDetail from './pages/Admin/AdminUserDetail';

function ProtectedRoute() {
  const { user, loading } = useAuthStore();
  const location = useLocation();
  if (loading) return <div className="p-8 text-center text-muted">Loading Taskflow...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <><Topbar /><Outlet /></>;
}

function AdminRoute() {
  const { user } = useAuthStore();
  if (user?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    const handler = () => logout(false);
    window.addEventListener('taskflow:auth-expired', handler);
    return () => window.removeEventListener('taskflow:auth-expired', handler);
  }, [logout]);

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/share/:shareToken" element={<ShareView />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:id/board" element={<ProjectBoard />} />
        <Route path="/projects/:id/roadmap" element={<RoadmapOverview />} />
        <Route path="/projects/:id/settings" element={<ProjectSettings />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/my-tasks" element={<MyTasks />} />
        <Route path="/review" element={<CatchUp />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
