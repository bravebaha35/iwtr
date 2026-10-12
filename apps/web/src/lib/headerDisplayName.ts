import type { OnboardingStatus } from "@iwtr/shared-types";
import { avatarLabel } from "@/lib/avatars";

/**
 * The name next to the avatar in the top-right corner. A company owner is
 * always shown by their real name (OnboardingStatus.ownerName) — never their
 * random anonymous username, which they keep for reviews but which must not
 * appear here. Members see their chosen display name, then their username -
 * or the username first, when they ticked "Show my username in the
 * top-right corner" on Edit Profile > Customize.
 */
export function headerDisplayName(status: OnboardingStatus, isCompanyOwner: boolean): string {
  if (isCompanyOwner) return status.ownerName ?? "Company owner";
  const username = status.reviewUsername || avatarLabel(status.avatarKey);
  if (status.showUsernameInHeader && username) return username;
  return status.displayName || username || "Anonymous";
}
