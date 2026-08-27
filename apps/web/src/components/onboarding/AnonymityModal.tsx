"use client";

export function AnonymityModal({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl dark:bg-brand-900">
          🔒
        </div>
        <h2 className="mb-2 text-xl font-bold text-foreground">
          You are always anonymous
        </h2>
        <p className="mb-6 text-sm leading-6 text-muted-foreground">
          Your name, birth date, and phone number are encrypted and never shown
          to anyone &mdash; not other users, not employers, not even us in day-to-day use. They exist
          only to confirm you&apos;re a real person and to prevent someone from creating duplicate
          accounts. Every review and comment you post is completely anonymous.
        </p>
        <button
          onClick={onContinue}
          className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          I understand, continue
        </button>
      </div>
    </div>
  );
}
