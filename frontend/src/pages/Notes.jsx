import { StickyNote } from 'lucide-react';

// Placeholder for the Notes nav slot -- the real feature ships separately.
// This just occupies the route/nav position so the bottom nav and routing
// are ready ahead of that work.
export default function Notes() {
  return (
    <main className="page-container py-6">
      <h1 className="text-xl font-bold">Notes</h1>
      <div className="card mt-4 p-10 text-center text-muted">
        <StickyNote size={28} className="mx-auto mb-3 text-slate-300" />
        No notes yet.
      </div>
    </main>
  );
}
