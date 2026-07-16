import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import ProjectTabs from '../components/ProjectTabs';
import DocEditModal from '../components/docs/DocEditModal';
import { docsApi, docCategoriesApi, projectsApi } from '../api/endpoints';

const STATUS_FILTERS = [
  ['', 'All'],
  ['ACTIVE', 'Active'],
  ['RETIRED', 'Retired']
];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function ProjectDocs() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [projectTitle, setProjectTitle] = useState('');
  const [docs, setDocs] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    docsApi.list(id).then(({ data }) => setDocs(data));
  }

  useEffect(() => {
    load();
    docCategoriesApi.list(id).then(({ data }) => setCategories(data));
    projectsApi.detail(id).then(({ data }) => setProjectTitle(data.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function toggleCategory(catKey) {
    setSelectedCategoryIds((prev) => (prev.includes(catKey) ? prev.filter((c) => c !== catKey) : [...prev, catKey]));
  }

  const filtered = useMemo(() => {
    if (!docs) return [];
    return docs.filter((doc) => {
      if (selectedCategoryIds.length) {
        const catKey = doc.categoryId || 'none';
        if (!selectedCategoryIds.includes(catKey)) return false;
      }
      if (statusFilter && doc.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!doc.title.toLowerCase().includes(q) && !doc.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [docs, selectedCategoryIds, statusFilter, search]);

  if (!docs) return <main className="p-8 text-center text-muted">Loading docs...</main>;

  return (
    <main>
      <div className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button className="btn-icon" onClick={() => navigate('/dashboard')} aria-label="Back"><ArrowLeft size={17} /></button>
            <h1 className="truncate text-base font-semibold">{projectTitle}</h1>
          </div>
          <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New entry</button>
        </div>
      </div>

      <ProjectTabs projectId={id} active="docs" />

      <section className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input className="field max-w-sm" placeholder="Search title or body..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex rounded-md border border-[#d8e0ea] bg-white p-1">
            {STATUS_FILTERS.map(([value, label]) => (
              <button
                key={value}
                className={`rounded px-3 py-1.5 text-sm font-semibold ${statusFilter === value ? 'bg-primary text-white' : 'text-muted'}`}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {[{ id: 'none', name: 'Uncategorized' }, ...categories].map((cat) => (
            <button
              key={cat.id}
              className={`chip border ${selectedCategoryIds.includes(cat.id) ? 'border-primary bg-blue-50 text-primary' : 'border-[#d8e0ea] text-muted'}`}
              onClick={() => toggleCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {!filtered.length && <div className="card p-10 text-center text-muted">No docs match.</div>}

        {Boolean(filtered.length) && (
          <div className="card divide-y divide-slate-100">
            {filtered.map((doc) => (
              <button
                key={doc.id}
                className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left text-sm hover:bg-slate-50 sm:flex-nowrap sm:gap-3"
                onClick={() => navigate(`/projects/${id}/docs/${doc.id}`)}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
                <span className="chip shrink-0 bg-slate-100 text-muted">{doc.category?.name || 'Uncategorized'}</span>
                <span className={`chip shrink-0 ${doc.status === 'RETIRED' ? 'bg-slate-100 text-muted' : 'bg-emerald-50 text-emerald-700'}`}>
                  {doc.status === 'RETIRED' ? 'Retired' : 'Active'}
                </span>
                <span className="w-20 shrink-0 text-right text-xs text-muted">{formatDate(doc.updatedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {creating && (
        <DocEditModal
          projectId={id}
          categories={categories}
          onClose={() => setCreating(false)}
          onSaved={(doc) => navigate(`/projects/${id}/docs/${doc.id}`)}
        />
      )}
    </main>
  );
}
