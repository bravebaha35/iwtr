"use client";

// Notice & Takedown (Uyar-Kaldır) — static legal copy triggered from
// GlobalFooter.tsx's Legal column. See TermsModal.tsx's file-header comment
// for the shared reasoning (frontend-only, explicit font-sans).
export function NoticeTakedownModal({ onClose }: { onClose: () => void }) {
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

        <h2 className="mb-4 pr-8 text-xl font-bold text-foreground">Notice &amp; Takedown (Uyar-Kaldır)</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Operating under Law No. 5651, iworkedthere.com acts as a secure hosting provider. If a corporate entity
          believes a review contains illegal defamation, exposed corporate trade secrets, or unfair competition, they
          must use this official channel to report it. We review all claims strictly. We will remove definitively
          illegal content to protect the platform&apos;s integrity, but we will never hand over a worker&apos;s
          identity or data to a complaining employer.
        </p>
      </div>
    </div>
  );
}
