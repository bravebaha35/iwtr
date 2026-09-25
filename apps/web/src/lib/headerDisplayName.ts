import type { OnboardingStatus } from "@iwtr/shared-types";
import { avatarLabel } from "@/lib/avatars";

/**
 * The name next to the avatar in the top-right corner. A company owner is
 * always shown by their real name (OnboardingStatus.ownerName) — never their
 * random anonymous username, which they keep for reviews but which must not
 * appear here. Members see their chosen display name, then their username.
 */
export function headerDisplayName(status: OnboardingStatus, isCompanyOwner: boolean): string {
  if (isCompanyOwner) return status.ownerName ?? "Company owner";
  return status.displayName || status.reviewUsername || avatarLabel(status.avatarKey) || "Anonymous";
}
