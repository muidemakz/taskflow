import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, maxWidthClass = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
      <div className={`card w-full ${maxWidthClass} p-5 max-h-[90vh] overflow-y-auto`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
