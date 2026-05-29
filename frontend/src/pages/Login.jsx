import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.email || !form.password) return setError('Email and password are required.');
    await login(form);
    toast.success('Welcome back');
    navigate('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-primary">Taskflow</h1>
        <p className="mt-1 text-sm text-muted">Log in to manage projects.</p>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 space-y-3">
          <input className="field" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="field" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn-primary mt-5 w-full">Log in</button>
        <p className="mt-4 text-center text-sm text-muted">No account? <Link className="font-semibold text-primary" to="/register">Register</Link></p>
      </form>
    </main>
  );
}
