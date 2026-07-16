import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import DocEditModal from '../components/docs/DocEditModal';
import TableOfContents from '../components/docs/TableOfContents';
import MarginNotesRail from '../components/docs/MarginNotesRail';
import { docsApi, docCategoriesApi, annotationsApi } from '../api/endpoints';
import { renderMarkdown } from '../utils/markdown';

export default function DocDetail() {
  const { id, docId } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [categories, setCategories] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [linkedTasks, setLinkedTasks] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function loadDoc() {
    return docsApi.detail(id, docId).then(({ data }) => setDoc(data));
  }

  function loadAnnotations() {
    annotationsApi.list(id, docId).then(({ data }) => setAnnotations(data));
  }

  useEffect(() => {
    loadDoc();
    loadAnnotations();
    docsApi.linkedTasks(id, docId).then(({ data }) => setLinkedTasks(data));
    docCategoriesApi.list(id).then(({ data }) => setCategories(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, docId]);

  const { html, headings } = useMemo(() => (doc ? renderMarkdown(doc.body) : { html: '', headings: [] }), [doc]);

  function selectHeading(headingId) {
    setActiveId(headingId);
    document.getElementById(headingId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById(`notes-${headingId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function confirmDelete() {
    try {
      await docsApi.remove(id, docId);
      toast.success('Doc deleted. Restore it from Trash within 30 days.');
      navigate(`/projects/${id}/docs`);
    } catch {
      toast.error('Could not delete doc');
      setDeleting(false);
    }
  }

  function openTask(task) {
    navigate(`/projects/${id}/board?taskId=${task.id}`);
  }

  if (!doc) return <main className="p-8 text-center text-muted">Loading...</main>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button className="btn-icon shrink-0" onClick={() => navigate(`/projects/${id}/docs`)} aria-label="Back">
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{doc.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="chip bg-slate-100 text-muted">{doc.category?.name || 'Uncategorized'}</span>
              <span className={`chip ${doc.status === 'RETIRED' ? 'bg-slate-100 text-muted' : 'bg-emerald-50 text-emerald-700'}`}>
                {doc.status === 'RETIRED' ? 'Retired' : 'Active'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>
          <button className="btn-icon text-red-700 hover:bg-red-50" onClick={() => setDeleting(true)} aria-label="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {linkedTasks.length > 0 && (
        <section className="card mb-5 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Linked tasks</h2>
          <div className="flex flex-wrap gap-2">
            {linkedTasks.map((task) => (
              <button
                key={task.id}
                className="chip border border-[#d8e0ea] bg-white text-text hover:border-blue-200"
                onClick={() => openTask(task)}
              >
                {task.title}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[200px_1fr_300px]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Contents</h3>
            <TableOfContents headings={headings} activeId={activeId} onSelect={selectHeading} />
          </div>
        </aside>

        <article className="prose-doc card min-w-0 p-6" dangerouslySetInnerHTML={{ __html: html }} />

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <MarginNotesRail
            projectId={id}
            docId={docId}
            headings={headings}
            annotations={annotations}
            activeId={activeId}
            onChange={loadAnnotations}
          />
        </aside>
      </div>

      {editing && (
        <DocEditModal
          projectId={id}
          doc={doc}
          categories={categories}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); loadDoc(); }}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          title={`Delete "${doc.title}"?`}
          warning="This entry will be moved to Trash, where it can be restored within 30 days."
          onConfirm={confirmDelete}
          onClose={() => setDeleting(false)}
        />
      )}
    </main>
  );
}
