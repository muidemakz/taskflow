import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, LogOut, Shield, Trash2 } from 'lucide-react';
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
  const { user, logout, setUser } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [tokens, setTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  function refreshTokens() {
    return tokensApi.list().then(({ data }) => setTokens(data));
  }

  useEffect(() => {
    refreshTokens().finally(() => setLoadingTokens(false));
  }, []);

  async function saveProfile(overrides = {}) {
    setSavingProfile(true);
    try {
      const { data } = await usersApi.update({ name, avatarUrl, ...overrides });
      setUser(data);
      toast.success('Profile updated');
    } catch {
      toast.error('Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onAvatarSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarUrl(dataUrl);
      await saveProfile({ avatarUrl: dataUrl });
    } catch {
      toast.error('Could not process that image');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function changeTheme(theme) {
    applyTheme(theme.toLowerCase());
    try {
      const { data } = await usersApi.update({ theme });
      setUser(data);
    } catch {
      toast.error('Could not save theme preference');
    }
  }

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

      <section className="card mt-4 p-4">
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            className="group relative h-[100px] w-[100px] shrink-0 overflow-hidden rounded-full border border-border dark:border-slate-700"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change avatar"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-blue-50 text-3xl font-bold text-primary dark:bg-blue-950 dark:text-blue-300">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-xs font-semibold text-white group-hover:flex">
              {uploadingAvatar ? 'Uploading…' : 'Change'}
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarSelected} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="block text-xs font-semibold text-muted">Name</label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary mt-4 w-full justify-center" disabled={savingProfile || !name.trim()} onClick={() => saveProfile()}>
          Save profile
        </button>

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
      </section>

      <SecuritySection user={user} />

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

function SecuritySection({ user }) {
  const navigate = useNavigate();
  const { setUser, logout } = useAuthStore();

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveEmail(event) {
    event.preventDefault();
    setEmailError('');
    if (!newEmail.trim() || !emailPassword) return setEmailError('New email and current password are required.');
    setSavingEmail(true);
    try {
      const { data } = await usersApi.changeEmail({ email: newEmail.trim(), currentPassword: emailPassword });
      setUser(data);
      setNewEmail('');
      setEmailPassword('');
      toast.success('Email updated');
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Could not update email');
    } finally {
      setSavingEmail(false);
    }
  }

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
    <section className="card mt-4 p-4">
      <h2 className="font-semibold">Security</h2>

      <form onSubmit={saveEmail} className="mt-3 space-y-2 border-b border-border pb-4 dark:border-slate-700">
        <p className="text-xs font-semibold text-muted">Change email (current: {user?.email})</p>
        {emailError && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{emailError}</p>}
        <input className="field" type="email" placeholder="New email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <input className="field" type="password" placeholder="Current password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
        <button className="btn-ghost w-full justify-center" disabled={savingEmail}>{savingEmail ? 'Saving…' : 'Update email'}</button>
      </form>

      <form onSubmit={savePassword} className="mt-4 space-y-2">
        <p className="text-xs font-semibold text-muted">Change password</p>
        {passwordError && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{passwordError}</p>}
        <input className="field" type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        <input className="field" type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <input className="field" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        <button className="btn-ghost w-full justify-center" disabled={savingPassword}>{savingPassword ? 'Saving…' : 'Update password'}</button>
      </form>
    </section>
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
