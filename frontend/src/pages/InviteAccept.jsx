import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { invitesApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [invite, setInvite] = useState(undefined); // undefined = loading, null = invalid
  const [form, setForm] = useState({ name: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    invitesApi.get(token).then(({ data }) => setInvite(data)).catch(() => setInvite(null));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.name.trim() || form.password.length < 8) return setError('Name and an 8+ character password are required.');
    if (form.password !== form.confirm) return setError('Passwords must match.');
    setSubmitting(true);
    try {
      const { data } = await invitesApi.accept(token, { name: form.name.trim(), password: form.password });
      setSession(data);
      toast.success('Account created');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not accept invite');
    } finally {
      setSubmitting(false);
    }
  }

  if (invite === undefined) {
    return <main className="flex min-h-screen items-center justify-center px-4 text-muted">Loading invite...</main>;
  }

  if (invite === null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card w-full max-w-md p-6 text-center">
          <h1 className="text-xl font-bold">Invite not found</h1>
          <p className="mt-2 text-sm text-muted">This invite link is invalid, expired, or has already been used.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-primary">Join Taskflow</h1>
        <p className="mt-1 text-sm text-muted">
          You've been invited as <span className="font-semibold text-text">{invite.role === 'ADMIN' ? 'an admin' : 'a user'}</span> with {invite.email}.
        </p>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 space-y-3">
          <input className="field" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="field" placeholder="Confirm password" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </div>
        <button className="btn-primary mt-5 w-full justify-center" disabled={submitting}>{submitting ? 'Creating account…' : 'Accept invite'}</button>
      </form>
    </main>
  );
}
