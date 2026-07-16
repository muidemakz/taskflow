import { X } from 'lucide-react';

// Header (and footer, if given) stay fixed; only the body between them
// scrolls. `min-h-0` on the scroll container is required for it to actually
// shrink inside a flex column instead of pushing the card past max-h-[90vh].
export default function Modal({ title, children, onClose, maxWidthClass = 'max-w-lg', footer = null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
      <div className={`card flex w-full ${maxWidthClass} max-h-[90vh] flex-col p-5`}>
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
        {footer && <div className="mt-4 shrink-0 border-t border-border pt-4">{footer}</div>}
      </div>
    </div>
  );
}
