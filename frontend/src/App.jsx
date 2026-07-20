import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Topbar from './components/Topbar';
import BottomNav from './components/BottomNav';
import { useAuthStore } from './store/authStore';
import { watchSystemTheme } from './utils/theme';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProjectHome from './pages/ProjectHome';
import ProjectBoard from './pages/ProjectBoard';
import RoadmapOverview from './pages/RoadmapOverview';
import DocDetail from './pages/DocDetail';
import Trash from './pages/Trash';
import Notes from './pages/Notes';
import NoteChat from './pages/NoteChat';
import MyTasks from './pages/MyTasks';
import CatchUp from './pages/CatchUp';
import AccountPage from './pages/AccountPage';
import ShareView from './pages/ShareView';
import AdminLayout from './pages/Admin/AdminLayout';
import AdminOverview from './pages/Admin/AdminOverview';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminUserDetail from './pages/Admin/AdminUserDetail';
import AdminActivity from './pages/Admin/AdminActivity';
import InviteAccept from './pages/InviteAccept';

function ProtectedRoute() {
  const { user, loading } = useAuthStore();
  const location = useLocation();
  if (loading) return <div className="p-8 text-center text-muted">Loading Taskflow...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return (
    <>
      <Topbar />
      <div className="pb-16">
        <Outlet />
      </div>
      <BottomNav />
    </>
  );
}

// Docs is now a tab of the unified project workspace (RoadmapOverview), not
// its own route. This keeps old /docs links (bookmarks, other components)
// working by sending them to the equivalent ?tab=docs URL.
function DocsTabRedirect() {
  const { id } = useParams();
  return <Navigate to={`/projects/${id}/roadmap?tab=docs`} replace />;
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
  useEffect(() => watchSystemTheme(), []);

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/share/:shareToken" element={<ShareView />} />
      <Route path="/invite/:token" element={<InviteAccept />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects/:id" element={<ProjectHome />} />
        <Route path="/projects/:id/board" element={<ProjectBoard />} />
        <Route path="/projects/:id/roadmap" element={<RoadmapOverview />} />
        <Route path="/projects/:id/docs" element={<DocsTabRedirect />} />
        <Route path="/projects/:id/docs/:docId" element={<DocDetail />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/:id" element={<NoteChat />} />
        <Route path="/my-tasks" element={<MyTasks />} />
        <Route path="/review" element={<CatchUp />} />
        <Route path="/account" element={<AccountPage />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="activity" element={<AdminActivity />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
