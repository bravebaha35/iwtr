import { RANDOMIZED_IDENTITY_AVATAR_GRADIENT, RANDOMIZED_IDENTITY_AVATAR_KEY } from "@iwtr/shared-types";

/**
 * The one name a review's author is ever shown by: the review's own one-off
 * displayUsername when "randomize my identity" was ticked, otherwise the
 * author's permanent reviewUsername. Shared by the public review list and the
 * company side of a review conversation, so what a company sees in its
 * messages inbox can never differ from (or be linked across) what the public
 * review already shows.
 */
export function publicReviewerName(
  review: { isRandomizedIdentity: boolean; displayUsername: string | null },
  author: { reviewUsername: string | null } | null | undefined,
): string | null {
  return review.isRandomizedIdentity ? review.displayUsername : (author?.reviewUsername ?? null);
}

/**
 * The avatar that goes with publicReviewerName: the fixed generic avatar for
 * a randomized review (so it can't be matched to the author's other reviews
 * by a repeating picture), otherwise the author's own chosen avatar.
 */
export function publicReviewerAvatar(
  review: { isRandomizedIdentity: boolean },
  author: { avatarKey: string | null; avatarGradient: string | null } | null | undefined,
): { avatarKey: string | null; avatarGradient: string | null } {
  if (review.isRandomizedIdentity) {
    return { avatarKey: RANDOMIZED_IDENTITY_AVATAR_KEY, avatarGradient: RANDOMIZED_IDENTITY_AVATAR_GRADIENT };
  }
  return { avatarKey: author?.avatarKey ?? null, avatarGradient: author?.avatarGradient ?? null };
}
