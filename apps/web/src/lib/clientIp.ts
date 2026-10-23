import { isIP } from "node:net";

// apps/api only ever sees this web server's own address, because every
// browser request reaches it through our server-side fetches (the proxy route
// and the login/register handlers). Rate limits per visitor and the Law 5651
// traffic log need the visitor's address instead, so those fetches pass it on
// in X-Forwarded-For, and apps/api trusts that header from this server only
// (API_TRUST_PROXY in apps/api).
//
// Review and private-conversation traffic never gets here with an address:
// src/proxy.ts strips every identifying header from it first, so for those
// requests this returns nothing and the API sees only this server.
//
// Which entry to believe: each proxy in front of this server (the host's TLS
// terminator, a CDN, ...) appends the address it saw to X-Forwarded-For, and
// anything to the left of those can be typed in by the visitor. So the
// visitor is the entry WEB_TRUSTED_PROXY_HOPS places from the right
// (default 1: one proxy in front, the usual hosting setup). Without a proxy in
// front (local dev), Next itself fills the header with the connection's
// address when it is missing.
export function visitorIp(headers: Headers, hops = trustedHops()): string | null {
  const raw = headers.get("x-forwarded-for");
  if (!raw) return null;
  const entries = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const candidate = entries[entries.length - Math.max(hops, 1)];
  if (!candidate) return null;
  // "::ffff:1.2.3.4" is how Node reports an IPv4 visitor on a dual-stack socket.
  const ip = candidate.startsWith("::ffff:") && isIP(candidate.slice(7)) === 4 ? candidate.slice(7) : candidate;
  return isIP(ip) ? ip : null;
}

function trustedHops(): number {
  const n = Number(process.env.WEB_TRUSTED_PROXY_HOPS ?? "1");
  return Number.isInteger(n) && n >= 0 ? n : 1;
}

/** Headers to add to a server-side fetch to apps/api on a visitor's behalf. */
export function forwardedForHeaders(headers: Headers): Record<string, string> {
  const ip = visitorIp(headers);
  return ip ? { "X-Forwarded-For": ip } : {};
}
