"use client";

export function AnonymityModal({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-xl dark:bg-zinc-900">
        <div className="mb-4 text-4xl">🔒</div>
        <h2 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          You are always anonymous
        </h2>
        <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Your name, T.C. Kimlik No, birth date, and phone number are encrypted and never shown
          to anyone &mdash; not other users, not employers, not even us in day-to-day use. They exist
          only to confirm you&apos;re a real person and to prevent someone from creating duplicate
          accounts. Every review and comment you post is completely anonymous.
        </p>
        <button
          onClick={onContinue}
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          I understand, continue
        </button>
      </div>
    </div>
  );
}
