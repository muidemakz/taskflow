import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsApi } from '../api/endpoints';

// /projects/:id is a smart redirect, not a page: it always sends visitors
// to the current primary view (board or roadmap) rather than the legacy
// groups/checklist page. Anything that already knows hasRoadmap (e.g.
// ProjectCard) skips this hop and navigates directly; this exists for
// entry points that don't (search results, bookmarks, old links).
export default function ProjectHome() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    projectsApi.detail(id)
      .then(({ data }) => navigate(data.hasRoadmap ? `/projects/${id}/roadmap` : `/projects/${id}/board`, { replace: true }))
      .catch(() => navigate('/dashboard', { replace: true }));
  }, [id, navigate]);

  return <main className="p-8 text-center text-muted">Loading project...</main>;
}
