import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Which rate-limit bucket a request counts against. Every browser request
 * reaches this API through apps/web's same-origin proxy, so req.ip is the
 * web server's address for everyone — keying by it put every signed-in
 * user in one shared bucket (5 reviews a minute for the whole site) and
 * tied rate limiting to network addresses. A signed-in caller is bucketed
 * by account instead. The token is only decoded here, not verified:
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
