import { ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE, type WorkplaceType } from "@iwtr/shared-types";

// Not cryptographic — this is cosmetic display text, not a secret or a
// security token, so Math.random() is the right tool rather than a CSPRNG.
// Used both for the "randomize my identity" per-review one-off (see
// ReviewsService.submitReview/updateReview) and to auto-assign a user's
// permanent reviewUsername at onboarding (OnboardingService.submitAvatar).
export function pickRandomDisplayUsername(workplaceType: WorkplaceType): string {
  const pool = ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE[workplaceType];
  return pool[Math.floor(Math.random() * pool.length)];
}

// The frontend's avatarKey->WorkplaceType mapping (apps/web/src/lib/avatars.ts's
// WORK_TYPE_AVATARS) is presentation data (emoji per variant) that has no
// reason to exist on the backend — but OnboardingService.submitAvatar still
// needs to know which category to auto-assign a reviewUsername from given
// only the avatarKey it just received. Mirrors the one piece of that mapping
// that actually matters here: the "office_"/"remote_"/"service_"/"manual_"
// prefix convention every avatarKey already follows.
export function workTypeFromAvatarKey(avatarKey: string): WorkplaceType {
  if (avatarKey.startsWith("remote_")) return "HYBRID_REMOTE";
  if (avatarKey.startsWith("service_")) return "SERVICE";
  if (avatarKey.startsWith("manual_")) return "MANUAL_LABOUR";
  return "OFFICE";
}
