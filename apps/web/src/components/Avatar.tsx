import { avatarEmoji } from "@/lib/avatars";
import { avatarGradientCss } from "@/lib/avatarGradients";

const SIZES = {
  sm: "h-8 w-8 text-base",
  md: "h-16 w-16 text-3xl",
} as const;

/**
 * Single point of edit for rendering a user's anonymous avatar (workplace-type
 * icon over their chosen gradient) anywhere in the app — the header badge and
 * the onboarding picker's live preview both go through this.
 */
export function Avatar({
  avatarKey,
  avatarGradient,
  size = "sm",
}: {
  avatarKey: string | null | undefined;
  avatarGradient: string | null | undefined;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      className={`flex ${SIZES[size]} shrink-0 items-center justify-center rounded-full`}
      style={{ background: avatarGradientCss(avatarGradient) }}
    >
      {avatarEmoji(avatarKey) ?? "🦫"}
    </span>
  );
}
