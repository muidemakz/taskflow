import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import StatusSettingsList from './StatusSettingsList';
import GateSettingsList from './GateSettingsList';
import TagSettingsList from './TagSettingsList';
import GateImportPanel from './GateImportPanel';
import { useBoardStore } from '../../store/boardStore';
import { projectsApi } from '../../api/endpoints';

// Status/Gate/Tag CRUD below stay instant-save, same as the settings page
// they replace -- each row already persists itself the moment it changes.
// Rollover mode is the one field genuinely held as a draft here, so Cancel
// has something real to discard and warn about.
export default function ProjectSettingsModal({ projectId, onClose }) {
  const loadProjectMeta = useBoardStore((s) => s.loadProjectMeta);
  const statuses = useBoardStore((s) => s.statuses);
  const gates = useBoardStore((s) => s.gates);
  const tags = useBoardStore((s) => s.tags);
  const [rolloverMode, setRolloverMode] = useState(null);
  const [initialRolloverMode, setInitialRolloverMode] = useState(null);
  const [saving, setSaving] = useState(false);

  function refresh() {
    return loadProjectMeta(projectId);
  }

  useEffect(() => {
    refresh();
    projectsApi.detail(projectId).then(({ data }) => {
      setRolloverMode(data.rolloverMode);
      setInitialRolloverMode(data.rolloverMode);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const hasUnsavedChanges = rolloverMode !== null && rolloverMode !== initialRolloverMode;

  function handleCancel() {
    if (hasUnsavedChanges && !confirm('You changed the rollover mode without saving. Discard that change?')) return;
    onClose();
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (hasUnsavedChanges) {
        await projectsApi.update(projectId, { rolloverMode });
        toast.success('Settings saved');
      }
      onClose();
    } catch {
      toast.error('Could not save settings');
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Project settings"
      onClose={handleCancel}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={handleCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      }
    >
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Statuses</h2>
        <p className="mb-3 text-sm text-muted">Exactly one status is the &ldquo;Done&rdquo; status -- it's the only one that counts toward progress.</p>
        <StatusSettingsList statuses={statuses} onChange={refresh} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Gates</h2>
        <p className="mb-3 text-sm text-muted">Adding a gate starts this project's roadmap.</p>
        <GateSettingsList gates={gates} projectId={projectId} onChange={refresh} />
        <GateImportPanel projectId={projectId} onImported={refresh} />
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Rollover mode</h2>
        <p className="mb-3 text-sm text-muted">What happens to incomplete tasks when a gate closes.</p>
        {rolloverMode && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className={`flex flex-1 items-start gap-2 rounded-md border p-3 text-sm ${rolloverMode === 'AUTOMATIC' ? 'border-primary bg-blue-50' : 'border-border'}`}>
              <input type="radio" name="rollover-mode" className="mt-0.5" checked={rolloverMode === 'AUTOMATIC'} onChange={() => setRolloverMode('AUTOMATIC')} />
              <span><strong>Automatic</strong> — roll over immediately, no confirmation</span>
            </label>
            <label className={`flex flex-1 items-start gap-2 rounded-md border p-3 text-sm ${rolloverMode === 'ASK_FIRST' ? 'border-primary bg-blue-50' : 'border-border'}`}>
              <input type="radio" name="rollover-mode" className="mt-0.5" checked={rolloverMode === 'ASK_FIRST'} onChange={() => setRolloverMode('ASK_FIRST')} />
              <span><strong>Ask first</strong> — show incomplete tasks before rolling over</span>
            </label>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Tags</h2>
        <TagSettingsList tags={tags} onChange={refresh} />
      </section>
    </Modal>
  );
}
