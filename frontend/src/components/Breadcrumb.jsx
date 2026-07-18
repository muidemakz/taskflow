import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Minimal breadcrumb bar. Each item is { label, to? } -- items with a `to`
// render as links, the last (current) item renders as plain text. Truncates
// long labels so the row never wraps or pushes the layout at ~380px.
export default function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex min-w-0 items-center gap-1 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="shrink-0 text-slate-400" />}
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
