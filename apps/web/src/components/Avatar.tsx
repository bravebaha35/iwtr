"use client";

import { useState } from "react";
import Image from "next/image";
import { isOwnStaticAsset } from "@/lib/imageSource";
import { avatarImageUrl } from "@/lib/avatars";
import { avatarGradientCss } from "@/lib/avatarGradients";

const SIZES = {
  sm: "h-8 w-8 text-base",
  // A review's byline (ReviewsList): a step up from sm so the beaver reads.
  review: "h-11 w-11 text-xl",
  md: "h-16 w-16 text-3xl",
} as const;

/**
 * Single point of edit for rendering an identity's circular avatar anywhere
 * in the app — the header badge, the onboarding picker's live preview, and
 * a comment/review's byline all go through this. Two distinct looks:
 * `photoUrl` (a company owner's real, verified photo — see
 * PublicSocialComment.avatarPhotoUrl) always wins when present, same
 * priority-with-fallback pattern CompanyLogo already uses for a company's
 * own photo; otherwise the anonymous beaver (avatarKey, see lib/avatars.ts)
 * over the chosen gradient (avatarGradient) - the art has a transparent
 * background, so the gradient shows around it.
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
  const beaverUrl = avatarImageUrl(avatarKey, size === "md" ? "lg" : "sm");

  if (photoUrl && !photoFailed) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={128}
        height={128}
        unoptimized={!isOwnStaticAsset(photoUrl)}
        onError={() => setPhotoFailed(true)}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`flex ${SIZES[size]} shrink-0 items-center justify-center overflow-hidden rounded-full`}
      style={{ background: avatarGradientCss(avatarGradient) }}
    >
      {beaverUrl ? (
        // Already cropped and sized (scripts/crop-avatars.mjs), so served as is.
        <Image src={beaverUrl} alt="" width={128} height={128} unoptimized className="h-full w-full" />
      ) : (
        "🦫"
      )}
    </span>
  );
}
