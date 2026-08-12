// Base for authenticated client-side calls: the same-origin Next.js proxy
// (src/app/api/proxy/[...path]/route.ts), which attaches the access token
// from an httpOnly cookie server-side — browser JS never touches it.
const PROXY_BASE_URL = "/api/proxy";

// Base for unauthenticated calls made from Server Components (no browser
// cookies involved at all, so there's no reason to route through the proxy).
const DIRECT_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const message =
      (body as { message?: string })?.message ??
      `Request failed: ${res.status} ${res.statusText}`;
    throw new ApiError(typeof message === "string" ? message : JSON.stringify(message), res.status, body);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, { cache: "no-store" });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, { method: "DELETE", cache: "no-store" });
  return handle<T>(res);
}

// Server Components only (e.g. app/companies/[slug]/page.tsx) — calls
// apps/api directly since there's no browser session to proxy.
export async function apiGetPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${DIRECT_API_BASE_URL}${path}`, { cache: "no-store" });
  return handle<T>(res);
}
