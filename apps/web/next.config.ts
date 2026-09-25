import type { NextConfig } from "next";

// Sent on every response. HSTS keeps browsers on HTTPS for two years so an
// anonymous session can't be downgraded to plain HTTP (browsers ignore it
// over http://localhost, so dev is unaffected); the plain-HTTP -> HTTPS
// redirect itself lives in src/proxy.ts. The rest are standard hardening:
// no MIME sniffing, no framing (clickjacking), no full-URL referrers to
// other sites, and no camera/microphone/location/ad-tracking APIs.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), interest-cohort=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // This repo maintains its own CLAUDE.md by hand; don't let next dev
  // overwrite it with an auto-generated AGENTS.md/CLAUDE.md stub on every run.
  agentRules: false,
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
