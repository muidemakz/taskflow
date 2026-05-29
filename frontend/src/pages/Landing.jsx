import { ArrowRight, CheckCircle2, Share2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <main className="min-h-screen bg-bg">
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1fr_0.85fr]">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-blue-100 bg-white px-3 py-1 text-sm font-semibold text-primary shadow-sm">Taskflow</div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-text sm:text-6xl">Create tasks. Share progress. Get things done.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">A clean project manager for private workspaces, public progress links, and admin oversight.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary">Start free <ArrowRight size={17} /></Link>
            <Link to="/login" className="btn-ghost">Log in</Link>
          </div>
        </div>
        <div className="card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Fortnoto launch checklist</h2>
            <span className="chip bg-[#eaf8ef] text-success">122/227 done</span>
          </div>
          <div className="progress-track"><div className="progress-fill w-[54%]" /></div>
          <div className="mt-5 space-y-3">
            {[
              ['Create structured groups', CheckCircle2],
              ['Publish read-only share links', Share2],
              ['Admin dashboard oversight', ShieldCheck]
            ].map(([label, Icon]) => (
              <div className="rounded-lg border border-border bg-slate-50 p-3" key={label}>
                <div className="flex items-center gap-3 text-sm font-semibold"><Icon size={17} className="text-primary" /> {label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
