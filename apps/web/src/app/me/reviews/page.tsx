import { redirect } from "next/navigation";

// My Ratings moved into Edit Profile (right under My CV). Old links and
// notifications still land in the right place, a review highlight included.
export default async function MyReviewsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ review?: string | string[] }>;
}) {
  const { review } = await searchParams;
  const reviewId = typeof review === "string" && /^[0-9a-f-]{36}$/i.test(review) ? review : null;
  redirect(reviewId ? `/me?tab=ratings&review=${reviewId}` : "/me?tab=ratings");
}
