"use client";

// Shown from the logged-out landing hero's contributor CTA — a placeholder
// explainer of how the site works, distinct from onboarding's AnonymityModal
// (which appears later, mid-flow, once someone's already registering).
export function WebsiteRulesModal({ onClose, onRegister }: { onClose: () => void; onRegister: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-lg rounded-xl bg-surface p-8 shadow-xl">
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

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl dark:bg-brand-900">
          🔒
        </div>
        <h2 className="mb-2 text-center text-xl font-bold text-foreground">How I Worked There works</h2>
        <p className="mb-4 text-sm leading-6 text-muted-foreground">
          You confirm your identity once during registration (including your T.C. Kimlik No), purely to stop
          duplicate and fake accounts. That identity data is encrypted separately from everything you post and is
          never shown to anyone — not other users, not employers, not even us in day-to-day use.
        </p>
        <p className="mb-6 text-sm leading-6 text-muted-foreground">
          Every review, rating, and comment you publish is <strong className="text-foreground">100% anonymous</strong>,
          protected under the Turkish Personal Data Protection Law (KVKK, Law No. 6698). Employers see aggregate
          scores and anonymous comments only — never who wrote them.
        </p>

        <button
          type="button"
          onClick={onRegister}
          className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Register for free
        </button>
      </div>
    </div>
  );
}
