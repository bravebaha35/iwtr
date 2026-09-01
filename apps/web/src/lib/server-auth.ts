// Server-only helpers for the httpOnly-cookie auth proxy (route handlers under
// src/app/api/**). Never import this from a "use client" file — next/headers
// throws outside a server context, which is the safety net if that happens.
import { NextResponse } from "next/server";
import type { AuthTokensResponse, LoginResult } from "@iwtr/shared-types";

export const ACCESS_COOKIE = "iwtr_access";
export const REFRESH_COOKIE = "iwtr_refresh";

// Mirrors apps/api/src/modules/auth/token.service.ts's REFRESH_TOKEN_TTL_MS.
// The access-token cookie's maxAge instead comes from the API's own
// `expiresInSeconds` response field, so only this one needs manual upkeep.
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

function baseCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function accessCookieOptions(maxAgeSeconds: number) {
  return baseCookieOptions(maxAgeSeconds);
}

export function refreshCookieOptions() {
  return baseCookieOptions(REFRESH_TTL_SECONDS);
}

// Concurrent requests that all present the same stale (pre-rotation) refresh
// token must share a single upstream refresh call: apps/api revokes the
// entire session chain if it ever sees an already-rotated refresh token
// replayed (see AuthService.refresh), which would otherwise happen the
// moment two proxied requests hit a 401 around the same time — e.g. a page
// firing several fetches at once right after the access token expires.
//
// A plain "delete on settle" cache isn't enough: a page load routinely fires
// several parallel authenticated fetches (employment-history, survey-stats,
// reviews, company-claims, ...), and even though they all start together,
// they don't arrive at this server in the exact same tick. The first one to
// land resolves and evicts itself from the map almost immediately, so a
// sibling request arriving even a few milliseconds later finds the cache
// empty, presents the SAME (already-rotated) refresh token, and gets treated
// by apps/api as a replay — nuking the whole session out from under a
// perfectly legitimate page load. Keeping the settled result cached for a
// short grace window (instead of evicting it the instant it resolves) means
// every request in that burst shares the one rotated token pair.
const REFRESH_REUSE_GRACE_MS = 30_000;
const inFlightRefreshes = new Map<string, Promise<AuthTokensResponse | null>>();

export function refreshTokens(refreshToken: string): Promise<AuthTokensResponse | null> {
  const existing = inFlightRefreshes.get(refreshToken);
  if (existing) return existing;

  const attempt = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as AuthTokensResponse;
      if (!data.refreshToken) return null;
      return data;
    } catch {
      return null;
    }
  })();

  inFlightRefreshes.set(refreshToken, attempt);
  void attempt.finally(() => {
    setTimeout(() => inFlightRefreshes.delete(refreshToken), REFRESH_REUSE_GRACE_MS);
  });
  return attempt;
}

// Shared by /api/auth/register, /api/auth/verify-admin-otp, and
// /api/auth/dev-admin-login: all three always get back a plain
// AuthTokensResponse on success, so all three exchange it for httpOnly
// cookies the exact same way, instead of ever handing raw tokens back to
// browser JS. /api/auth/login is different (see exchangeLoginForSession
// below) — its upstream response can also be an OTP_REQUIRED placeholder
// with no tokens at all yet.
export async function exchangeCredentialsForSession(
  upstreamPath: "auth/register" | "auth/login/verify-otp" | "auth/dev-admin-login",
  body: string,
): Promise<NextResponse> {
  const upstream = await fetch(`${API_BASE_URL}/${upstreamPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    return new NextResponse(errorBody, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  const data = (await upstream.json()) as AuthTokensResponse;
  if (!data.refreshToken) {
    return NextResponse.json({ message: "Login did not return a refresh token" }, { status: 502 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ACCESS_COOKIE, data.accessToken, accessCookieOptions(data.expiresInSeconds));
  res.cookies.set(REFRESH_COOKIE, data.refreshToken, refreshCookieOptions());
  return res;
}

// /api/auth/login's upstream response is a LoginResult, not a plain
// AuthTokensResponse: every account except the hardcoded ADMIN email gets
// status "OK" (tokens, handled exactly like exchangeCredentialsForSession
// above); the ADMIN email instead gets "OTP_REQUIRED" with no tokens at
// all yet — that gets passed straight through to the browser as-is (no
// cookies to set), so AuthModal can show the 6-digit code step and then
// call /api/auth/verify-admin-otp once it has one.
export async function exchangeLoginForSession(body: string): Promise<NextResponse> {
  const upstream = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  if (!upstream.ok) {
    const errorBody = await upstream.text();
    return new NextResponse(errorBody, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  const data = (await upstream.json()) as LoginResult;
  if (data.status === "OTP_REQUIRED") {
    return NextResponse.json(data);
  }
  if (!data.refreshToken) {
    return NextResponse.json({ message: "Login did not return a refresh token" }, { status: 502 });
  }

  const res = NextResponse.json({ status: "OK" as const });
  res.cookies.set(ACCESS_COOKIE, data.accessToken, accessCookieOptions(data.expiresInSeconds));
  res.cookies.set(REFRESH_COOKIE, data.refreshToken, refreshCookieOptions());
  return res;
}

export function decodeAccessTokenClaims(accessToken: string): { role: string; exp: number } | null {
  try {
    const payload = accessToken.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const claims = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { role?: string; exp?: number };
    if (typeof claims.role !== "string" || typeof claims.exp !== "number") return null;
    return { role: claims.role, exp: claims.exp };
  } catch {
    return null;
  }
}
