import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
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

  // GET admin/social/companies/:id/posts — that company's feed, bypassing the
  // hidden-company visibility gate so a hidden company's posts stay visible
  // and removable from here (the public GET /social/companies/:slug/posts
  // 404s once a company is hidden, for everyone, by design).
  @Get("companies/:id/posts")
  companyFeed(@Param("id", new ParseUUIDPipe()) id: string, @Query("cursor") cursor?: string) {
    return this.social.adminCompanyFeed(id, { cursor });
  }

  // GET admin/social/reported-comments — every comment with at least one
  // report, flagged (crossed 3 reports + matched the content filter) ones
  // first. No author identity in the response (see SocialService.
  // listReportedComments).
  @Get("reported-comments")
  listReportedComments() {
    return this.social.listReportedComments();
  }

  // POST admin/social/comments/:id/dismiss-report — "reviewed, nothing
  // wrong here", clears the flag without deleting anything.
  @Post("comments/:id/dismiss-report")
  dismissReport(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.social.adminDismissReport(id);
  }

  // DELETE admin/social/comments/:id — remove one comment,
  // AuditLog "SOCIAL_COMMENT_REMOVED". 404 if missing.
  @Delete("comments/:id")
  removeComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.social.adminRemoveComment(user.id, id);
  }

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
