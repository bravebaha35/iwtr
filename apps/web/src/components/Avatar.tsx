"use client";

import { useState } from "react";
import { avatarEmoji } from "@/lib/avatars";
import { avatarGradientCss } from "@/lib/avatarGradients";

const SIZES = {
  sm: "h-8 w-8 text-base",
  md: "h-16 w-16 text-3xl",
} as const;

/**
 * Single point of edit for rendering an identity's circular avatar anywhere
 * in the app — the header badge, the onboarding picker's live preview, and
 * a comment/review's byline all go through this. Two distinct looks:
 * `photoUrl` (a company owner's real, verified photo — see
 * PublicSocialComment.avatarPhotoUrl) always wins when present, same
 * priority-with-fallback pattern CompanyLogo already uses for a company's
 * own photo; otherwise the anonymous workplace-type icon over the chosen
 * gradient (avatarKey/avatarGradient), unchanged from before.
 */
export function Avatar({
  avatarKey,
  avatarGradient,
  photoUrl,
  size = "sm",
}: {
  avatarKey: string | null | undefined;
  avatarGradient: string | null | undefined;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);

  if (photoUrl && !photoFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        onError={() => setPhotoFailed(true)}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`flex ${SIZES[size]} shrink-0 items-center justify-center rounded-full`}
      style={{ background: avatarGradientCss(avatarGradient) }}
    >
      {avatarEmoji(avatarKey) ?? "🦫"}
    </span>
  );
}
