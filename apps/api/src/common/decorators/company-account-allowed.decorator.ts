import { SetMetadata } from "@nestjs/common";

export const COMPANY_ACCOUNT_ALLOWED = "companyAccountAllowed";

/**
 * Opens a route to a company's shared login (see CompanyLogin and
 * JwtAuthGuard). Every other authenticated route refuses such a session, so
 * the owner's personal profile, CV, reviews and ID details stay out of reach.
 * A route with a :companyId param is further limited to the session's own
 * company by the guard; a route without one must limit itself (read
 * user.companyScope) - e.g. a conversation or review id that belongs to
 * some company.
 */
export const CompanyAccountAllowed = () => SetMetadata(COMPANY_ACCOUNT_ALLOWED, true);
