import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import PromptFormModal from './PromptFormModal';
import CopyPromptModal from './CopyPromptModal';
import { promptsApi } from '../../api/endpoints';

const TARGET_TOOL_LABELS = {
  FIGMA_AI: 'Figma AI',
  CLAUDE_CODE: 'Claude Code',
  FIGMA_MAKE: 'Figma Make',
  OTHER: 'Other'
};

const STATUS_LABELS = { DRAFT: 'Draft', FINAL: 'Final', USED: 'Used' };
const STATUS_STYLES = {
  DRAFT: 'bg-slate-100 text-muted',
  FINAL: 'bg-emerald-50 text-emerald-700',
  USED: 'bg-blue-50 text-primary'
};

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Badges({ version }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="chip bg-slate-100 text-muted">{TARGET_TOOL_LABELS[version.targetTool] || version.targetTool}</span>
      <span className={`chip ${STATUS_STYLES[version.status] || 'bg-slate-100 text-muted'}`}>{STATUS_LABELS[version.status] || version.status}</span>
    </div>
  );
}

// Task detail's Prompts panel -- entirely manual/non-AI: versions are
// created and copied by hand here, no generation call anywhere in this file.
export default function PromptsPanel({ projectId, taskId, promptRulesCategoryId }) {
  const [versions, setVersions] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copyBody, setCopyBody] = useState(null);

  function refresh() {
    promptsApi.list(projectId, taskId).then(({ data }) => setVersions(data));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function markUsed(id) {
    try {
      const updated = await promptsApi.markUsed(id);
      setVersions((prev) => prev.map((v) => (v.id === id ? updated.data : v)));
      toast.success('Marked as used');
    } catch {
      toast.error('Could not mark as used');
    }
  }

  async function copyPrompt(body) {
    if (promptRulesCategoryId) {
      setCopyBody(body);
      return;
    }
    await navigator.clipboard.writeText(body);
    toast.success('Prompt copied');
  }

  if (versions === null) return null;

  const [current, ...history] = versions;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Prompt</label>
        {current && (
          <button className="btn-ghost" onClick={() => setShowForm(true)}>Change prompt</button>
        )}
      </div>

      {!current && (
        <button className="btn-primary" onClick={() => setShowForm(true)}>Create prompt</button>
      )}

      {current && (
        <div className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Badges version={current} />
            <div className="flex items-center gap-2">
              <button className="btn-icon h-7 w-7" onClick={() => copyPrompt(current.body)} aria-label="Copy prompt">
                <Copy size={14} />
              </button>
              {current.status !== 'USED' && (
                <button className="btn-ghost" onClick={() => markUsed(current.id)}>Mark as used</button>
              )}
            </div>
          </div>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 font-mono text-xs">{current.body}</pre>
          {current.directionNote && <p className="mt-2 text-xs italic text-muted">{current.directionNote}</p>}
          <p className="mt-2 text-xs text-muted">
            Created {formatDate(current.createdAt)}{current.usedAt ? ` · Used ${formatDate(current.usedAt)}` : ''}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-2">
          <button className="btn-ghost" onClick={() => setHistoryOpen((v) => !v)}>
            {historyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Version history ({history.length})
          </button>
          {historyOpen && (
            <div className="mt-2 space-y-2">
              {history.map((version) => (
                <div key={version.id} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badges version={version} />
                    <div className="flex items-center gap-2">
                      <button className="btn-icon h-7 w-7" onClick={() => copyPrompt(version.body)} aria-label="Copy prompt">
                        <Copy size={14} />
                      </button>
                      {version.status !== 'USED' && (
                        <button className="btn-ghost" onClick={() => markUsed(version.id)}>Mark as used</button>
                      )}
                    </div>
                  </div>
                  <p className="truncate text-xs text-muted">{version.body}</p>
                  {version.directionNote && <p className="mt-1 text-xs italic text-muted">{version.directionNote}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Created {formatDate(version.createdAt)}{version.usedAt ? ` · Used ${formatDate(version.usedAt)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <PromptFormModal
          projectId={projectId}
          taskId={taskId}
          current={current}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refresh(); }}
        />
      )}

      {copyBody !== null && (
        <CopyPromptModal
          projectId={projectId}
          categoryId={promptRulesCategoryId}
          promptBody={copyBody}
          onClose={() => setCopyBody(null)}
        />
      )}
    </div>
  );
}
