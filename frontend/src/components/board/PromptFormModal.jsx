import { useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';
import Modal from '../Modal';
import { promptsApi } from '../../api/endpoints';

const TARGET_TOOLS = [
  ['FIGMA_AI', 'Figma AI'],
  ['CLAUDE_CODE', 'Claude Code'],
  ['FIGMA_MAKE', 'Figma Make'],
  ['OTHER', 'Other']
];

// Flag-gated (Prompt 6): [Generate] only renders when the frontend build has
// AI generation enabled. Backend independently gates the actual call, so
// this is purely a UI toggle, not the source of truth for access.
const AI_GENERATION_ENABLED = import.meta.env.VITE_ENABLE_AI_GENERATION === 'true';

// Used for both "Create prompt" (no `current`) and "Change prompt" (current
// pre-fills the form) -- either way Save always POSTs a new PromptVersion,
// it never updates one in place.
export default function PromptFormModal({ projectId, taskId, current, onClose, onSaved }) {
  const [body, setBody] = useState(current?.body || '');
  const [targetTool, setTargetTool] = useState(current?.targetTool || 'CLAUDE_CODE');
  const [directionNote, setDirectionNote] = useState(current?.directionNote || '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Tracks only whether Generate was used in *this* form session -- reopening
  // "Change prompt" later starts false again, even if the saved version it's
  // prefilled from was itself generated.
  const [wasGenerated, setWasGenerated] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const { data } = await promptsApi.generate(taskId);
      setBody(data.body);
      setWasGenerated(true);
    } catch {
      toast.error('Generation failed. Try again or edit manually.');
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!body.trim()) return toast.error('Prompt body is required');
    setSaving(true);
    try {
      const { data } = await promptsApi.create(projectId, taskId, {
        body: body.trim(),
        targetTool,
        directionNote: directionNote.trim() || undefined,
        generated: wasGenerated
      });
      toast.success(current ? 'New prompt version saved' : 'Prompt created');
      onSaved(data);
    } catch {
      toast.error('Could not save prompt');
      setSaving(false);
    }
  }

  return (
    <Modal
      title={current ? 'Change prompt' : 'Create prompt'}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      }
    >
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Target tool</label>
        <select className="field" value={targetTool} onChange={(e) => setTargetTool(e.target.value)}>
          {TARGET_TOOLS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted">Prompt body</label>
          {AI_GENERATION_ENABLED && (
            <button className="btn-ghost h-7" onClick={generate} disabled={generating}>
              <Sparkles size={13} /> {generating ? 'Generating…' : 'Generate'}
            </button>
          )}
        </div>
        <textarea
          className="field min-h-40 font-mono text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write the prompt..."
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Direction note (optional)</label>
        <textarea
          className="field min-h-16"
          value={directionNote}
          onChange={(e) => setDirectionNote(e.target.value)}
          placeholder="Why this version, what changed..."
        />
      </div>
    </Modal>
  );
}
