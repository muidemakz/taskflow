import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Copy, KeyRound, LogOut, Mail, Shield, Trash2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { tokensApi, usersApi } from '../api/endpoints';
import { applyTheme } from '../utils/theme';
import Modal from '../components/Modal';

const THEME_OPTIONS = [
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
  { value: 'SYSTEM', label: 'System' }
];

// Cover-crops to a square before downscaling so non-square photos don't get
// squashed, then re-encodes as JPEG -- keeps the data: URL small enough to
// live directly on the User row (no object storage in this app).
function resizeImageToDataUrl(file, size = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function AccountPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [tokens, setTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  function refreshTokens() {
    return tokensApi.list().then(({ data }) => setTokens(data));
  }

  useEffect(() => {
    refreshTokens().finally(() => setLoadingTokens(false));
  }, []);

  async function revokeToken(id) {
    try {
      await tokensApi.remove(id);
      toast.success('Token revoked');
      refreshTokens();
    } catch {
      toast.error('Could not revoke token');
    }
  }

  const activeTokens = tokens.filter((t) => !t.revokedAt);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-xl font-bold">Account</h1>

      <ProfileSection user={user} />

      <SecuritySection user={user} />

      <TrashSection />

      <section className="card mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">API Tokens</h2>
          <button className="btn-ghost" onClick={() => setCreateOpen(true)}>+ Create</button>
        </div>
        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
          {loadingTokens && <p className="py-3 text-sm text-muted">Loading…</p>}
          {!loadingTokens && activeTokens.length === 0 && <p className="py-3 text-sm text-muted">No active tokens.</p>}
          {activeTokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted">
                  Created {new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {t.lastUsedAt
                    ? ` · Last used ${new Date(t.lastUsedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                    : ' · Never used'}
                </p>
              </div>
              <button className="btn-icon shrink-0 text-red-600" onClick={() => revokeToken(t.id)} aria-label="Revoke token">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {user?.role === 'ADMIN' && (
        <button className="btn-ghost mt-4 w-full justify-center" onClick={() => navigate('/admin')}>
          <Shield size={16} /> Admin dashboard
        </button>
      )}

      <button
        className="btn-ghost mt-3 w-full justify-center text-red-600"
        onClick={async () => { await logout(); navigate('/login'); }}
      >
        <LogOut size={16} /> Log out
      </button>

      {createOpen && <CreateTokenModal onClose={() => setCreateOpen(false)} onCreated={refreshTokens} />}
    </main>
  );
}

function ProfileSection({ user }) {
  const { setUser } = useAuthStore();
  const [showNameModal, setShowNameModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  async function changeTheme(theme) {
    applyTheme(theme.toLowerCase());
    try {
      const { data } = await usersApi.update({ theme });
      setUser(data);
    } catch {
      toast.error('Could not save theme preference');
    }
  }

  return (
    <section className="card mt-4 p-4">
      <h2 className="font-semibold">Profile</h2>

      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 py-3 text-left"
          onClick={() => setShowAvatarModal(true)}
        >
          <span className="flex items-center gap-3">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border dark:border-slate-700">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-blue-50 text-sm font-bold text-primary dark:bg-blue-950 dark:text-blue-300">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </span>
            <span className="block text-sm font-medium">Photo</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted" />
        </button>

        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 py-3 text-left"
          onClick={() => setShowNameModal(true)}
        >
          <span className="flex items-center gap-2.5">
            <User size={16} className="text-muted" />
            <span>
              <span className="block text-sm font-medium">Name</span>
              <span className="block text-xs text-muted">{user?.name}</span>
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted" />
        </button>
      </div>

      <div className="mt-5">
        <label className="block text-xs font-semibold text-muted">Theme</label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                user?.theme === opt.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-[#d8e0ea] bg-white text-text dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
              }`}
              onClick={() => changeTheme(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {showAvatarModal && <EditAvatarModal user={user} onClose={() => setShowAvatarModal(false)} />}
      {showNameModal && <EditNameModal user={user} onClose={() => setShowNameModal(false)} />}
    </section>
  );
}

function EditNameModal({ user, onClose }) {
  const { setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  async function saveName(event) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data } = await usersApi.update({ name: name.trim() });
      setUser(data);
      toast.success('Name updated');
      onClose();
    } catch {
      toast.error('Could not update name');
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit name" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        This is the name shown across Taskflow — in the topbar, on tasks you create, and to
        anyone you share a project or gate with.
      </p>
      <form onSubmit={saveName} className="space-y-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <button className="btn-primary mt-2 w-full justify-center" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : 'Save name'}
        </button>
      </form>
    </Modal>
  );
}

function EditAvatarModal({ user, onClose }) {
  const { setUser } = useAuthStore();
  const fileInputRef = useRef(null);
  const [pendingUrl, setPendingUrl] = useState(user?.avatarUrl || '');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessing(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPendingUrl(dataUrl);
    } catch {
      toast.error('Could not process that image');
    } finally {
      setProcessing(false);
    }
  }

  async function savePhoto() {
    setSaving(true);
    try {
      const { data } = await usersApi.update({ avatarUrl: pendingUrl });
      setUser(data);
      toast.success('Photo updated');
      onClose();
    } catch {
      toast.error('Could not update photo');
      setSaving(false);
    }
  }

  const changed = pendingUrl !== (user?.avatarUrl || '');

  return (
    <Modal title="Edit photo" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        Upload a photo to personalize your account — it shows up in the topbar and anywhere your
        name appears. Square photos work best; we'll crop and resize it automatically.
      </p>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          className="group relative h-[100px] w-[100px] shrink-0 overflow-hidden rounded-full border border-border dark:border-slate-700"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Choose photo"
        >
          {pendingUrl ? (
            <img src={pendingUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-blue-50 text-3xl font-bold text-primary dark:bg-blue-950 dark:text-blue-300">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-xs font-semibold text-white group-hover:flex">
            {processing ? 'Processing…' : 'Choose photo'}
          </span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
        <button type="button" className="btn-ghost text-sm" onClick={() => fileInputRef.current?.click()}>
          Choose a different photo
        </button>
      </div>
      <button className="btn-primary mt-4 w-full justify-center" disabled={saving || processing || !changed} onClick={savePhoto}>
        {saving ? 'Saving…' : 'Save photo'}
      </button>
    </Modal>
  );
}

// Trash is a full page (/trash), not a modal -- a list this size, plus its
// own search, deserved room to breathe rather than living in a modal. This
// row is just the entry point; clicking it navigates there instead of
// opening anything in place.
function TrashSection() {
  const navigate = useNavigate();

  return (
    <section className="card mt-4 p-4">
      <h2 className="font-semibold">Data</h2>
      <div className="mt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 py-1 text-left"
          onClick={() => navigate('/trash')}
        >
          <span className="flex items-center gap-2.5">
            <Trash2 size={16} className="text-muted" />
            <span className="block text-sm font-medium">Trash</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted" />
        </button>
      </div>
    </section>
  );
}

function SecuritySection({ user }) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  return (
    <section className="card mt-4 p-4">
      <h2 className="font-semibold">Security</h2>

      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 py-3 text-left"
          onClick={() => setShowEmailModal(true)}
        >
          <span className="flex items-center gap-2.5">
            <Mail size={16} className="text-muted" />
            <span>
              <span className="block text-sm font-medium">Change email</span>
              <span className="block text-xs text-muted">{user?.email}</span>
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted" />
        </button>

        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 py-3 text-left"
          onClick={() => setShowPasswordModal(true)}
        >
          <span className="flex items-center gap-2.5">
            <KeyRound size={16} className="text-muted" />
            <span className="block text-sm font-medium">Change password</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted" />
        </button>
      </div>

      {showEmailModal && <ChangeEmailModal user={user} onClose={() => setShowEmailModal(false)} />}
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </section>
  );
}

function ChangeEmailModal({ user, onClose }) {
  const { setUser } = useAuthStore();
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [done, setDone] = useState(false);

  async function saveEmail(event) {
    event.preventDefault();
    setEmailError('');
    if (!newEmail.trim() || !emailPassword) return setEmailError('New email and current password are required.');
    setSavingEmail(true);
    try {
      const { data } = await usersApi.changeEmail({ email: newEmail.trim(), currentPassword: emailPassword });
      setUser(data);
      setDone(true);
      toast.success('Email updated');
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Could not update email');
    } finally {
      setSavingEmail(false);
    }
  }

  if (done) {
    return (
      <Modal title="Email updated" onClose={onClose}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950">
            <Check size={22} />
          </div>
          <p className="text-sm text-muted">
            You're all set — sign-ins now use <span className="font-medium text-text">{newEmail.trim()}</span>.
          </p>
          <button className="btn-primary w-full justify-center" onClick={onClose}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Change email" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        Your current email is <span className="font-medium text-text">{user?.email}</span>. Enter the new address you'd
        like to use, plus your current password to confirm it's you — you'll use the new email to sign in from now on.
      </p>
      <form onSubmit={saveEmail} className="space-y-2">
        {emailError && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{emailError}</p>}
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">New email</label>
          <input
            className="field"
            type="email"
            placeholder="you@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Current password</label>
          <input className="field" type="password" placeholder="Confirm it's you" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
        </div>
        <button className="btn-primary mt-2 w-full justify-center" disabled={savingEmail}>
          {savingEmail ? 'Updating…' : 'Update email'}
        </button>
      </form>
    </Modal>
  );
}

function ChangePasswordModal({ onClose }) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function savePassword(event) {
    event.preventDefault();
    setPasswordError('');
    if (!currentPassword || newPassword.length < 8) return setPasswordError('Current password and an 8+ character new password are required.');
    if (newPassword !== confirmPassword) return setPasswordError('New passwords must match.');
    setSavingPassword(true);
    try {
      await usersApi.changePassword({ currentPassword, newPassword });
      toast.success('Password changed. Please log in again.');
      await logout(false);
      navigate('/login');
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Could not change password');
      setSavingPassword(false);
    }
  }

  return (
    <Modal title="Change password" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        Choose a new password to keep your account secure. Once it's changed you'll be signed out here and anywhere
        else you're logged in, so make sure you'll remember it (or save it in a password manager) before continuing.
      </p>
      <form onSubmit={savePassword} className="space-y-2">
        {passwordError && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{passwordError}</p>}
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Current password</label>
          <input className="field" type="password" placeholder="Your current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">New password</label>
          <input className="field" type="password" placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">Confirm new password</label>
          <input className="field" type="password" placeholder="Type it again" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button className="btn-primary mt-2 w-full justify-center" disabled={savingPassword}>
          {savingPassword ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </Modal>
  );
}

function CreateTokenModal({ onClose, onCreated }) {
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const { data } = await tokensApi.create(label.trim());
      setCreated(data);
      onCreated();
    } catch {
      toast.error('Could not create token');
    } finally {
      setCreating(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(created.token);
    setCopied(true);
    toast.success('Copied to clipboard');
  }

  return (
    <Modal title={created ? 'Token created' : 'Create API token'} onClose={onClose}>
      {!created ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted">Name (optional)</label>
            <input className="field mt-1" placeholder="e.g. CLI on laptop" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <button className="btn-primary w-full justify-center" disabled={creating} onClick={create}>
            {creating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Copy this token now — you won't be able to see it again.</p>
          <div className="flex items-center gap-2 rounded-md border border-[#d8e0ea] bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
            <code className="min-w-0 flex-1 truncate text-xs">{created.token}</code>
            <button className="btn-icon shrink-0" onClick={copy} aria-label="Copy token">
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <button className="btn-ghost w-full justify-center" onClick={onClose}>Done</button>
        </div>
      )}
    </Modal>
  );
}
