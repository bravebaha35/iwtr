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
    // The API answers with JSON, PDFs and uploaded images, never a page, so
    // nothing it sends may run scripts, load anything or be framed.
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
    if (opts.production && proto === "http") {
      res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
      return;
    }
    next();
  };
}

/**
 * Express "trust proxy" value from API_TRUST_PROXY: a hop count ("1"),
 * "false", or address names/ranges ("loopback", "10.0.0.0/8, ...").
 * Unset means "loopback": only the web server on this same machine.
 * "true" (believe anyone) is deliberately not accepted: any caller could
 * then pick the address their requests are logged and rate-limited under.
 */
export function trustProxySetting(raw: string | undefined): boolean | number | string {
  const value = (raw ?? "").trim();
  if (value === "") return "loopback";
  if (value === "true") throw new Error('API_TRUST_PROXY="true" would believe any caller\'s X-Forwarded-For. Give a hop count or address range.');
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
