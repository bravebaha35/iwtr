import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { FollowsService } from "./follows.service";

// Unprefixed controller, full literal paths per route — same convention as
// NotificationsController/OwnerController (see their own "me/*" routes).
@Controller()
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  // Toggle the caller's follow on a company. Employee-only: "Owners cannot
  // act as employee followers" is this guard, full stop — the same
  // mechanism (RolesGuard) already gates every ADMIN/COMPANY_OWNER route in
  // this codebase, so there is exactly one place this rule can drift.
  @Post("me/follows/companies/:companyId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  toggleCompanyFollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
  ) {
    return this.follows.toggleCompanyFollow(user.id, companyId);
  }

  // The caller's own followed-companies list.
  @Get("me/follows/companies")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  followedCompanies(@CurrentUser() user: AuthenticatedUser) {
    return this.follows.listFollowedCompanies(user.id);
  }

  // Toggle the caller's follow on another employee (both pseudonymous).
  @Post("me/follows/users/:userId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  toggleUserFollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId", new ParseUUIDPipe()) targetUserId: string,
  ) {
    return this.follows.toggleUserFollow(user.id, targetUserId);
  }

  // Owner-only, ownership-checked per company (not just role) — same
  // "/my-companies/:companyId/..." convention as turnover-risk/job-postings.
  // SECURITY: returns { count } ONLY — see FollowsService.companyFollowerCount
  // and REVIEW.md. Never add a sibling endpoint here that lists followers.
  @Get("my-companies/:companyId/follower-count")
  @UseGuards(JwtAuthGuard)
  companyFollowerCount(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
  ) {
    return this.follows.companyFollowerCount(user.id, companyId);
  }
}
