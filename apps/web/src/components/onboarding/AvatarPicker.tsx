"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiPost, ApiError } from "@/lib/api-client";
import { AVATARS } from "@/lib/avatars";

export function AvatarPicker({ onSubmitted }: { onSubmitted: () => void }) {
  const { accessToken } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/onboarding/avatar", { avatarKey: selected }, accessToken ?? undefined);
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl dark:bg-zinc-900">
        <h2 className="mb-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Pick an anonymous avatar
        </h2>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          This is how you&apos;ll appear to other users. Last step!
        </p>

        <div className="mb-6 grid grid-cols-4 gap-3">
          {AVATARS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setSelected(a.key)}
              className={`flex aspect-square items-center justify-center rounded-full text-3xl transition ${a.bg} ${
                selected === a.key
                  ? "ring-3 ring-brand-600 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900"
                  : "hover:brightness-95 dark:hover:brightness-110"
              }`}
            >
              {a.emoji}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={!selected || submitting}
          className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Finish"}
        </button>
      </div>
    </div>
  );
}
