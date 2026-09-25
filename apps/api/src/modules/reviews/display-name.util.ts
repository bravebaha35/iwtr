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
