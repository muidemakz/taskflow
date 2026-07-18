import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import ProjectTabs from '../components/ProjectTabs';
import SharedFilterBar from '../components/SharedFilterBar';
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
  const [filters, setFilters] = useState({ search: '', status: 'ACTIVE', categoryIds: [] });
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

  const filtered = useMemo(() => {
    if (!docs) return [];
    return docs.filter((doc) => {
      if (filters.categoryIds.length) {
        const catKey = doc.categoryId || 'none';
        if (!filters.categoryIds.includes(catKey)) return false;
      }
      if (filters.status && doc.status !== filters.status) return false;
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        if (!doc.title.toLowerCase().includes(q) && !doc.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [docs, filters]);

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

      <ProjectTabs projectId={id} active="docs" onNewEntry={() => setCreating(true)} />

      <SharedFilterBar
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters({ search: '', status: 'ACTIVE', categoryIds: [] })}
        placeholder="Search title or body..."
        filterFields={[
          {
            key: 'status',
            render: (f, set) => (
              <div className="flex rounded-md border border-border bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
                {STATUS_FILTERS.map(([value, label]) => (
                  <button
                    key={value}
                    className={`rounded px-3 py-1.5 text-sm font-semibold ${f.status === value ? 'bg-primary text-white' : 'text-muted'}`}
                    onClick={() => set({ status: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )
          },
          {
            key: 'categoryIds',
            render: (f, set) => (
              <div className="flex flex-wrap gap-1.5">
                {[{ id: 'none', name: 'Uncategorized' }, ...categories].map((cat) => (
                  <button
                    key={cat.id}
                    className={`chip border ${f.categoryIds.includes(cat.id) ? 'border-primary bg-blue-50 text-primary dark:border-blue-600 dark:bg-blue-900/40 dark:text-blue-300' : 'border-border text-muted dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                    onClick={() => set({ categoryIds: f.categoryIds.includes(cat.id) ? f.categoryIds.filter((c) => c !== cat.id) : [...f.categoryIds, cat.id] })}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )
          }
        ]}
      />

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
