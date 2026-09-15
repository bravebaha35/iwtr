import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SavedJobPostingsService } from "./saved-job-postings.service";

// `/me/*`-style routes (unprefixed controller), same convention as
// SavedPostsController and OwnerController's `me/owned-companies`.
@Controller()
export class SavedJobPostingsController {
  constructor(private readonly savedJobPostings: SavedJobPostingsService) {}

  @Post("me/saved-job-postings/:jobPostingId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  toggle(@CurrentUser() user: AuthenticatedUser, @Param("jobPostingId", new ParseUUIDPipe()) jobPostingId: string) {
    return this.savedJobPostings.toggle(user.id, jobPostingId);
  }

  @Get("me/saved-job-postings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.savedJobPostings.list(user.id);
  }
}
