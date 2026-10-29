import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../../modules/auth/token.service";
import type { AuthenticatedUser } from "../../modules/auth/auth.types";

export const REGISTER_TO_READ_MESSAGE = "Register or log in to see IWT Social.";

/**
 * For IWT Social reads (feed, posts, comments, questions, a company's social
 * tab): only someone with an account may read them. A logged-out request is
 * refused with 401, so the content can't be read or copied without
 * registering - the site's register wall is enforced here, not only on the
 * page. An expired token also gets 401, which makes the web proxy refresh the
 * session and retry.
 *
 * Who the reader is stays as private as before: like OptionalJwtAuthGuard, a
 * company-login session may read but is never set as `request.user` (it
 * reads as an anonymous visitor, never as the owner). Nothing about who read
 * what is stored.
 */
@Injectable()
export class RegisteredReaderGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException(REGISTER_TO_READ_MESSAGE);
    let claims: ReturnType<TokenService["verifyAccessToken"]>;
    try {
      claims = this.tokens.verifyAccessToken(header.slice("Bearer ".length));
    } catch {
      throw new UnauthorizedException(REGISTER_TO_READ_MESSAGE);
    }
    if (!claims.cl) request.user = { id: claims.sub, role: claims.role, status: claims.status };
    return true;
  }
}
