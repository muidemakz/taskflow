import { Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft } from 'lucide-react';

// Minimal breadcrumb bar with optional back button. Each item is { label, to? } --
// items with a `to` render as links, the last (current) item renders as plain text.
// Pass onBack to show a back arrow; it replaces the first separator.
export default function Breadcrumb({ items = [], onBack }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex min-w-0 items-center gap-1 text-sm">
      {onBack && (
        <button
          onClick={onBack}
          className="btn-icon h-6 w-6 shrink-0"
          aria-label="Go back"
        >
          <ArrowLeft size={14} />
        </button>
      )}
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {(i > 0 || onBack) && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
            {item.to && !isLast ? (
              <Link to={item.to} className="breadcrumb-link max-w-[45vw] truncate sm:max-w-none">
                {item.label}
              </Link>
            ) : (
              <span className={`max-w-[55vw] truncate sm:max-w-none ${isLast ? 'font-semibold' : 'text-muted'}`}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
