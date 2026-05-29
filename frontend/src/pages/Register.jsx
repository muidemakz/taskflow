import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.name || !form.email || form.password.length < 8) return setError('Name, email, and an 8+ character password are required.');
    if (form.password !== form.confirm) return setError('Passwords must match.');
    await register({ name: form.name, email: form.email, password: form.password });
    toast.success('Account created');
    navigate('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-primary">Create Taskflow account</h1>
        <p className="mt-1 text-sm text-muted">Start managing and sharing progress.</p>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 space-y-3">
          <input className="field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="field" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="field" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="field" placeholder="Confirm password" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </div>
        <button className="btn-primary mt-5 w-full">Create account</button>
        <p className="mt-4 text-center text-sm text-muted">Already have an account? <Link className="font-semibold text-primary" to="/login">Log in</Link></p>
      </form>
    </main>
  );
}
