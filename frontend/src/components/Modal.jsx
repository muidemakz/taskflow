import { X } from 'lucide-react';

// Header (and footer, if given) stay fixed; only the body between them
// scrolls. `min-h-0` on the scroll container is required for it to actually
// shrink inside a flex column instead of pushing the card past max-h-[90dvh].
// Backdrop click closes the same way the X button does -- callers that need
// an unsaved-changes guard (DocEditModal, ProjectSettingsModal, ...) already
// wrap their own onClose with that check, so this gets the guard for free
// rather than needing separate backdrop-specific wiring.
//
// The overlay itself scrolls (rather than only centering the card via
// flexbox with no overflow) so that if the card is ever taller than the
// visible viewport -- which happens on mobile Safari whenever its
// collapsible toolbar eats into the real visible height -- the header and
// close button can always be reached by scrolling up, instead of being
// silently clipped off-screen with no way back. `dvh` (not `vh`) sizes the
// card against the *current* visible viewport rather than the browser's
// largest possible one, and the safe-area padding keeps the header clear of
// a notch/dynamic island.
export default function Modal({ title, children, onClose, maxWidthClass = 'max-w-lg', footer = null }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className={`card flex w-full ${maxWidthClass} max-h-[90dvh] flex-col p-5`} onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button className="btn-icon" onClick={onClose} aria-label="Close modal">
              <X size={17} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
          {footer && <div className="mt-4 shrink-0 border-t border-border pt-4 dark:border-slate-700">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
