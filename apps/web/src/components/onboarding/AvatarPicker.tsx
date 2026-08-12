"use client";

import { useState } from "react";
import { apiPost, ApiError } from "@/lib/api-client";
import { AVATAR_GRADIENTS } from "@/lib/avatarGradients";
import { Avatar } from "@/components/Avatar";
import { AvatarEditor } from "@/components/AvatarEditor";

export function AvatarPicker({ onSubmitted }: { onSubmitted: () => void }) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [selectedGradient, setSelectedGradient] = useState<string>(AVATAR_GRADIENTS[0].key);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    if (!selectedAvatar) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/onboarding/avatar", { avatarKey: selectedAvatar, avatarGradient: selectedGradient });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-surface p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <Avatar avatarKey={selectedAvatar} avatarGradient={selectedGradient} size="md" />
        </div>

        <h2 className="mb-1 text-xl font-bold text-foreground">Pick an anonymous avatar</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          This is how you&apos;ll appear to other users. Last step!
        </p>

        <AvatarEditor
          avatarKey={selectedAvatar}
          avatarGradient={selectedGradient}
          onChangeAvatarKey={setSelectedAvatar}
          onChangeGradient={setSelectedGradient}
        />

        {error && <p className="mb-3 mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={!selectedAvatar || submitting}
          className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Finish"}
        </button>
      </div>
    </div>
  );
}
