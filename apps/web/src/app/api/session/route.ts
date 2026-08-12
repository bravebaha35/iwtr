import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  decodeAccessTokenClaims,
  refreshTokens,
} from "@/lib/server-auth";

// The one thing browser JS is allowed to know about the session, now that
// the tokens themselves live in httpOnly cookies it can't read. Called once
// on app load and again whenever a tab regains focus (auth-context.tsx).
export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    const claims = decodeAccessTokenClaims(accessToken);
    const stillValid = claims !== null && claims.exp * 1000 - 60_000 > Date.now();
    if (stillValid) {
      return NextResponse.json({ isAuthenticated: true, role: claims.role });
    }
  }

  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  const refreshed = refreshToken ? await refreshTokens(refreshToken) : null;

  if (refreshed) {
    const claims = decodeAccessTokenClaims(refreshed.accessToken);
    const res = NextResponse.json({ isAuthenticated: true, role: claims?.role ?? null });
    res.cookies.set(ACCESS_COOKIE, refreshed.accessToken, accessCookieOptions(refreshed.expiresInSeconds));
    res.cookies.set(REFRESH_COOKIE, refreshed.refreshToken!, refreshCookieOptions());
    return res;
  }

  const res = NextResponse.json({ isAuthenticated: false, role: null });
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
