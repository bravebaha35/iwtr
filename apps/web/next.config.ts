import type { NextConfig } from "next";

// Sent on every response. HSTS keeps browsers on HTTPS for two years so an
// anonymous session can't be downgraded to plain HTTP (browsers ignore it
// over http://localhost, so dev is unaffected); the plain-HTTP -> HTTPS
// redirect itself lives in src/proxy.ts. The rest are standard hardening:
// no MIME sniffing, no framing (clickjacking), no full-URL referrers to
// other sites, and no camera/microphone/location/ad-tracking APIs.
const isDev = process.env.NODE_ENV === "development";

function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

// Uploaded logos, photos and banners are served by apps/api itself.
const API_ORIGIN = originOf(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1");
const ANALYTICS_ORIGIN = originOf(process.env.NEXT_PUBLIC_ANALYTICS_SRC);
// iyzico's hosted checkout form runs its own scripts, styles and frames.
const IYZICO = "https://*.iyzipay.com";

// Content-Security-Policy: what a page may load and from where. Scripts only
// from this site (plus iyzico and the analytics script, once one is set);
// the inline 'unsafe-inline' is what Next.js needs without per-request
// nonces, which would make every page dynamic (no caching). Images may come
// from any https address because companies' logo links point anywhere.
// Development adds what the dev server needs ('unsafe-eval', its websocket).
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${IYZICO} ${ANALYTICS_ORIGIN}${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline' ${IYZICO}`,
  `img-src 'self' data: blob: https: ${API_ORIGIN}`,
  `font-src 'self' data: ${IYZICO}`,
  `connect-src 'self' ${API_ORIGIN} ${IYZICO} ${ANALYTICS_ORIGIN}${isDev ? " ws: wss:" : ""}`,
  `media-src 'self' blob: ${API_ORIGIN}`,
  `frame-src 'self' ${IYZICO}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${IYZICO}`,
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
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
  // next/image re-encodes our own /public images as WebP at the size each
  // screen actually needs.
  images: { formats: ["image/webp"] },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
