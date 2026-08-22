import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  refreshTokens,
} from "@/lib/server-auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

function passthroughHeaders(res: Response): HeadersInit {
  const headers: HeadersInit = {};
  const contentType = res.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  return headers;
}

async function proxy(req: NextRequest, path: string[]) {
  const cookieStore = await cookies();
  const targetUrl = `${API_BASE_URL}/${path.join("/")}${req.nextUrl.search}`;
  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  // arrayBuffer, not text() — a multipart/form-data upload (e.g. the company
  // logo endpoint) carries raw binary bytes that text() would corrupt.
  // Forwarding the request's own content-type verbatim (rather than always
  // forcing "application/json") is what makes that work: a browser `fetch`
  // call with a FormData body sets its own multipart content-type including
  // the boundary token, which has to reach apps/api unchanged for it to
  // parse the body at all.
  const body = hasBody ? await req.arrayBuffer() : undefined;
  const contentType = req.headers.get("content-type");

  const send = (accessToken: string | undefined) =>
    fetch(targetUrl, {
      method,
      headers: {
        ...(hasBody && contentType ? { "Content-Type": contentType } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body,
      cache: "no-store",
    });

  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  let upstream = await send(accessToken);

  if (upstream.status === 401) {
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    const refreshed = refreshToken ? await refreshTokens(refreshToken) : null;

    if (refreshed) {
      upstream = await send(refreshed.accessToken);
      const responseBody = await upstream.text();
      const out = new NextResponse(responseBody, {
        status: upstream.status,
        headers: passthroughHeaders(upstream),
      });
      out.cookies.set(ACCESS_COOKIE, refreshed.accessToken, accessCookieOptions(refreshed.expiresInSeconds));
      out.cookies.set(REFRESH_COOKIE, refreshed.refreshToken!, refreshCookieOptions());
      return out;
    }

    if (refreshToken) {
      // A refresh token was presented but rejected — the session is dead,
      // not just the access token. Clear both cookies so the client's next
      // /api/session check reports logged-out instead of retrying forever.
      const responseBody = await upstream.text();
      const out = new NextResponse(responseBody, {
        status: upstream.status,
        headers: passthroughHeaders(upstream),
      });
      out.cookies.delete(ACCESS_COOKIE);
      out.cookies.delete(REFRESH_COOKIE);
      return out;
    }
  }

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: passthroughHeaders(upstream),
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
