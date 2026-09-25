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
  // Read as text first, not res.json() directly — a handler with no return
  // value (e.g. OwnerService.updateMyCompany) sends a 200 with an empty
  // body, and res.json() throws a SyntaxError on empty input rather than
  // resolving to something falsy. That threw error was indistinguishable
  // from a real failure to every caller: a successful void-returning PATCH
  // still landed in the caller's catch block as "Couldn't save changes."
  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const message =
      (body as { message?: string })?.message ??
      `Request failed: ${res.status} ${res.statusText}`;
    throw new ApiError(typeof message === "string" ? message : JSON.stringify(message), res.status, body);
  }
  return body as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, { cache: "no-store" });
  return handle<T>(res);
}

// Extra request headers for one call (e.g. the review form's spam-trap
// headers, see lib/formTrap.ts).
export interface ApiRequestOptions {
  headers?: Record<string, string>;
}

export async function apiPost<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<T> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<T> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

// Multipart upload (e.g. company logo) — no Content-Type header set here on
// purpose: the browser generates the multipart boundary itself only when
// left to set the header, and the proxy route now forwards whatever
// content-type the browser actually sent instead of forcing JSON.
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, {
    method: "POST",
    cache: "no-store",
    body: formData,
  });
  return handle<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, { method: "DELETE", cache: "no-store" });
  return handle<T>(res);
}

// Binary/blob fetch through the same authenticated proxy as apiGet (e.g. an
// applicant's CV PDF, which apps/api now serves only via an authenticated,
// ownership-checked route — see job-applications.controller.ts). apiGet
// always JSON-parses the response body via handle(), which would corrupt
// binary data, so this is a small separate helper rather than a mode flag
// on apiGet.
export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await fetch(`${PROXY_BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    // No JSON body to pull a message out of for a binary response — mirror
    // handle()'s fallback message shape as closely as that allows.
    throw new ApiError(`Request failed: ${res.status} ${res.statusText}`, res.status, null);
  }
  return res.blob();
}

// Server Components only (e.g. app/companies/[slug]/page.tsx) — calls
// apps/api directly since there's no browser session to proxy.
export async function apiGetPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${DIRECT_API_BASE_URL}${path}`, { cache: "no-store" });
  return handle<T>(res);
}
