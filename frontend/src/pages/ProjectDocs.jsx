import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
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
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Breadcrumb
        items={[{ label: projectTitle, to: `/projects/${id}/board` }]}
        onBack={() => navigate('/dashboard')}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Docs</h1>
          <p className="mt-1 text-sm text-muted">Project documentation, knowledge base, and reference materials.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={17} /> New entry</button>
      </div>

      <ProjectTabs projectId={id} active="docs" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="field max-w-sm" placeholder="Search title or body..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex rounded-md border border-[#d8e0ea] bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
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
            className={`chip border ${selectedCategoryIds.includes(cat.id) ? 'border-primary bg-blue-50 text-primary' : 'border-[#d8e0ea] text-muted dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
            onClick={() => toggleCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {!filtered.length && <div className="card p-10 text-center text-muted">No docs match.</div>}

      {Boolean(filtered.length) && (
        <div className="card divide-y divide-slate-100 dark:divide-slate-700">
          {filtered.map((doc) => (
            <button
              key={doc.id}
              className="flex w-full flex-col gap-1.5 px-3 py-3 text-left text-sm transition hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-3 dark:hover:bg-slate-900/50"
              onClick={() => navigate(`/projects/${id}/docs/${doc.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{doc.title}</p>
                <p className="mt-0.5 text-xs text-muted">{doc.category?.name || 'Uncategorized'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`chip shrink-0 ${doc.status === 'RETIRED' ? 'bg-slate-100 text-muted dark:bg-slate-700 dark:text-slate-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                  {doc.status === 'RETIRED' ? 'Retired' : 'Active'}
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-muted">{formatDate(doc.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

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
