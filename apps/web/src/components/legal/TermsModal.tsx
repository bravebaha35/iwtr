"use client";

// Terms of Service — static legal copy triggered from GlobalFooter.tsx's
// Legal column, replacing what used to be a dead "#" link. Frontend-only:
// no API/Prisma involvement, same as KVKKModal/NoticeTakedownModal next to
// this file. font-sans here is Plus Jakarta Sans (see --font-sans in
// globals.css) — set explicitly rather than relying on the inherited body
// default, since Mode B requires this modal never render in anything else.
export function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-8 font-sans shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="mb-4 pr-8 text-xl font-bold text-foreground">Terms of Service</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Welcome to iworkedthere.com. This platform belongs to the workers. You have the absolute right to rate
          your employer anonymously and share the true conditions of your workplace. In return, you must follow one
          strict rule: criticize the company and its operational processes, never individual people. Do not use real
          names, phone numbers, or targeted insults. We exist to protect your identity and elevate your voice, but we
          will strictly remove reviews that break the law or expose personal identities.
        </p>
      </div>
    </div>
  );
}
