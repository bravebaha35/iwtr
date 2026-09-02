"use client";

// KVKK Aydınlatma Metni — static legal copy triggered from GlobalFooter.tsx's
// Legal column. See TermsModal.tsx's file-header comment for the shared
// reasoning (frontend-only, explicit font-sans).
export function KVKKModal({ onClose }: { onClose: () => void }) {
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

        <h2 className="mb-4 pr-8 text-xl font-bold text-foreground">KVKK Aydınlatma Metni</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Under the Turkish Personal Data Protection Law (Law No. 6698), your identity is our most guarded secret. We
          do not collect your name or exact job title for public display. Any backend data we use to verify you are
          a real person is heavily encrypted, stripped from your public reviews, and permanently locked away from
          employers. We will never sell your personal information to third parties, agencies, or bosses.
        </p>
      </div>
    </div>
  );
}
