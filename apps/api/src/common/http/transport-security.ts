import type { NextFunction, Request, Response } from "express";

/**
 * HTTPS everywhere, so an anonymous session can never be downgraded to
 * plain HTTP on the way in. HSTS is sent on every response (browsers ignore
 * it over plain HTTP, so it's harmless on localhost); in production a request
 * that reached us over HTTP — as reported by the TLS-terminating proxy in
 * front of the app — is permanently redirected to HTTPS instead of served.
 */
export function transportSecurity(opts: { production: boolean }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");

    const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
    if (opts.production && proto === "http") {
      res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
      return;
    }
    next();
  };
}
