import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SocialService } from "./social.service";

// A `/me/*`-style route (unprefixed controller, full literal path — same
// convention as NotificationsController's `me/notifications` and
// OwnerController's `me/owned-companies`) rather than nested under
// SocialController's "social" prefix, which would wrongly produce
// /social/me/saved-posts.
@Controller()
export class SavedPostsController {
  constructor(private readonly social: SocialService) {}

  // The caller's own saved posts, cursor-paginated same as the main feed.
  // Employee-only (MEMBER) — saving is not an owner/admin feature.
  @Get("me/saved-posts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  savedPosts(@CurrentUser() user: AuthenticatedUser, @Query("cursor") cursor?: string) {
    return this.social.listSavedPosts(user.id, cursor);
  }
}
