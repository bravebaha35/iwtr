"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savedPostToggleResultSchema = exports.userFollowToggleResultSchema = exports.companyFollowerCountSchema = exports.followedCompanySummarySchema = exports.companyFollowToggleResultSchema = void 0;
const zod_1 = require("zod");
const company_1 = require("./company");
// --- Company follow (employee -> company). Toggle result mirrors
// SocialPostLikeResult's shape/convention exactly.
exports.companyFollowToggleResultSchema = zod_1.z.object({
    companyId: zod_1.z.string(),
    following: zod_1.z.boolean(),
});
// One company the caller follows — enough to render a card/list row without
// a second request per company. Never includes any follower-facing data;
// this is always the CALLER's own list.
exports.followedCompanySummarySchema = zod_1.z.object({
    companyId: zod_1.z.string(),
    companyName: zod_1.z.string(),
    companySlug: zod_1.z.string(),
    mainPhotoUrl: zod_1.z.string().nullable(),
    badgeTier: company_1.ownerTierSchema,
});
// SECURITY: this is the ONLY shape a company/owner may ever receive for its
// own followers — a bare integer, never a list. See REVIEW.md and
// FollowsService.companyFollowerCount.
exports.companyFollowerCountSchema = zod_1.z.object({
    count: zod_1.z.number().int().min(0),
});
// --- User follow (employee -> employee, both pseudonymous). Toggle only —
// no "who I follow" / "my followers" list endpoint exists (not requested).
exports.userFollowToggleResultSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    following: zod_1.z.boolean(),
});
// --- Saved posts (employee -> post). Toggle mirrors the like/follow
// convention above.
exports.savedPostToggleResultSchema = zod_1.z.object({
    postId: zod_1.z.string(),
    saved: zod_1.z.boolean(),
});
