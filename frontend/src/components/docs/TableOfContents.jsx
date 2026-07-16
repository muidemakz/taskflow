export default function TableOfContents({ headings, activeId, onSelect }) {
  if (!headings.length) return <p className="text-sm text-muted">No headings</p>;
  return (
    <nav className="space-y-0.5">
      {headings.map((h) => (
        <button
          key={h.id}
          className={`block w-full truncate rounded px-2 py-1 text-left text-sm transition ${
            activeId === h.id ? 'bg-blue-50 font-semibold text-primary' : 'text-muted hover:bg-slate-50'
          }`}
          style={{ paddingLeft: `${(h.level - 1) * 10 + 8}px` }}
          onClick={() => onSelect(h.id)}
        >
          {h.text}
        </button>
      ))}
    </nav>
  );
}
