import { z } from "zod";
import { ownerTierSchema } from "./company";

// --- Company follow (employee -> company). Toggle result mirrors
// SocialPostLikeResult's shape/convention exactly.
export const companyFollowToggleResultSchema = z.object({
  companyId: z.string(),
  following: z.boolean(),
});
export type CompanyFollowToggleResult = z.infer<typeof companyFollowToggleResultSchema>;

// One company the caller follows — enough to render a card/list row without
// a second request per company. Never includes any follower-facing data;
// this is always the CALLER's own list.
export const followedCompanySummarySchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  companySlug: z.string(),
  mainPhotoUrl: z.string().nullable(),
  badgeTier: ownerTierSchema,
});
export type FollowedCompanySummary = z.infer<typeof followedCompanySummarySchema>;

// SECURITY: this is the ONLY shape a company/owner may ever receive for its
// own followers — a bare integer, never a list. See REVIEW.md and
// FollowsService.companyFollowerCount.
export const companyFollowerCountSchema = z.object({
  count: z.number().int().min(0),
});
export type CompanyFollowerCount = z.infer<typeof companyFollowerCountSchema>;

// --- User follow (employee -> employee, both pseudonymous). Toggle only —
// no "who I follow" / "my followers" list endpoint exists (not requested).
export const userFollowToggleResultSchema = z.object({
  userId: z.string(),
  following: z.boolean(),
});
export type UserFollowToggleResult = z.infer<typeof userFollowToggleResultSchema>;

// --- Saved posts (employee -> post). Toggle mirrors the like/follow
// convention above.
export const savedPostToggleResultSchema = z.object({
  postId: z.string(),
  saved: z.boolean(),
});
export type SavedPostToggleResult = z.infer<typeof savedPostToggleResultSchema>;
