import { Controller, Delete, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SocialService } from "./social.service";

// ADMIN-only content moderation for IWT Social — a hard delete of a single
// post or of a whole company's feed (each also unlinks the WebP file from
// uploads/social/, best-effort). Same guard shape as AdminCompaniesController
// / AdminQueueController: class-level JwtAuthGuard + RolesGuard + @Roles is
// the real security boundary — RolesGuard throws 403 before SocialService
// ever runs for a non-ADMIN. Kept a separate controller from the public
// SocialController so nothing here is reachable without the ADMIN role.
//
// Anonymity unchanged: these operate on SocialPost by id / companyId only and
// never read or log a post/comment author (see REVIEW.md's social scope).
@Controller("admin/social")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminSocialController {
  constructor(private readonly social: SocialService) {}

  // DELETE admin/social/posts/:id — remove one post (cascades its comments +
  // likes), unlink its file, AuditLog "SOCIAL_POST_REMOVED". 404 if missing.
  @Delete("posts/:id")
  removePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.social.adminRemovePost(user.id, id);
  }

  // DELETE admin/social/companies/:id/posts — wipe a company's whole feed.
  // Returns { deletedCount }, AuditLog "SOCIAL_FEED_WIPED". An empty feed is
  // { deletedCount: 0 }, not an error.
  @Delete("companies/:id/posts")
  wipeCompanyFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.social.adminWipeCompanyFeed(user.id, id);
  }
}
