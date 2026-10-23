import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Which rate-limit bucket a request counts against. A signed-in caller is
 * bucketed by account, so limits follow the person, not a network address.
 * Everyone else by req.ip: the visitor's address, which apps/web passes on
 * (see main.ts "trust proxy") - except on review and conversation traffic,
 * where it is deliberately removed and req.ip is the web server's. The token is only decoded here, not verified:
 * JwtAuthGuard still rejects a forged one, and a forged `sub` could only
 * ever put its sender in a bucket of their own.
 */
export function throttleTrackerFor(req: { headers: Record<string, unknown>; ip?: string }): string {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const payload = header.slice("Bearer ".length).split(".")[1];
    if (payload) {
      try {
        const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown };
        if (typeof claims.sub === "string" && claims.sub.length > 0) return `account:${claims.sub}`;
      } catch {
        // Not a JWT — fall through to the address.
      }
    }
  }
  return `ip:${req.ip ?? "unknown"}`;
}

@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return throttleTrackerFor(req as { headers: Record<string, unknown>; ip?: string });
  }
}
