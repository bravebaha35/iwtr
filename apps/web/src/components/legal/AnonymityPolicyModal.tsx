"use client";

// Anonymity Policy — static copy triggered from GlobalFooter.tsx's Platform
// column. Was a plain "#" dead link; restored as a popup rather than a
// separate page, same pattern as TermsModal/KVKKModal/NoticeTakedownModal
// next to this file (frontend-only, explicit font-sans, see TermsModal.tsx's
// file-header comment for the shared reasoning). Text mirrors the site's
// existing anonymity language from onboarding/AnonymityModal.tsx and
// WebsiteRulesModal.tsx.
export function AnonymityPolicyModal({ onClose }: { onClose: () => void }) {
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

        <h2 className="mb-4 pr-8 text-xl font-bold text-foreground">Anonymity Policy</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          You are always anonymous. Your name, birth date, and phone number are encrypted and never shown to anyone
          &mdash; not other users, not employers, not even us in day-to-day use. They exist only to confirm you are a
          real person and to prevent someone from creating duplicate accounts. Every review and comment you post is
          completely anonymous, protected under the Turkish Personal Data Protection Law (KVKK, Law No. 6698).
          Employers see aggregate scores and anonymous comments only &mdash; never who wrote them.
        </p>
      </div>
    </div>
  );
}
