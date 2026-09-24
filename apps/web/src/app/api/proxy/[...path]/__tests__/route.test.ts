/**
 * @jest-environment node
 */

// State-leakage check for an anonymous review submission: the browser only
// ever holds an httpOnly session cookie, and this proxy is the one place that
// turns it into a bearer token. These tests pin down that the token and the
// reviewer's identity go no further than they must — only to apps/api, never
// back to the browser, and never with the reviewer's device details.
import { NextRequest } from "next/server";

const ACCESS_TOKEN = "header.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature";
const USER_ID = "user-123";

jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "iwtr_access" ? { value: ACCESS_TOKEN } : undefined),
  }),
}));

import { POST } from "../route";

const REVIEW_BODY = JSON.stringify({
  companyId: "7a0c1e1e-0000-4000-8000-000000000001",
  employmentHistoryId: "7a0c1e1e-0000-4000-8000-000000000002",
  answers: [],
  isRandomizedIdentity: true,
});

function submitReview(): Promise<Response> {
  const req = new NextRequest("http://localhost:3000/api/proxy/reviews", {
    method: "POST",
    body: REVIEW_BODY,
    headers: {
      "content-type": "application/json",
      cookie: `iwtr_access=${ACCESS_TOKEN}`,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      referer: "http://localhost:3000/companies/acme",
      "x-forwarded-for": "203.0.113.7",
    },
  });
  return POST(req, { params: Promise.resolve({ path: ["reviews"] }) });
}

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn(async () =>
    new Response(JSON.stringify({ reviewId: "r-1", status: "PUBLISHED", message: "ok", scores: {} }), {
      status: 201,
      headers: {
        "content-type": "application/json",
        // Anything upstream might add must never reach the browser.
        "set-cookie": "leak=1",
        authorization: `Bearer ${ACCESS_TOKEN}`,
        "x-user-id": USER_ID,
      },
    }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
});

it("forwards only Content-Type and the bearer token to apps/api, with the review body untouched", async () => {
  await submitReview();

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toMatch(/\/reviews$/);
  expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` });
  // Byte-for-byte the browser's body: nothing identifying is added on the way.
  expect(Buffer.from(init.body as ArrayBuffer).toString("utf8")).toBe(REVIEW_BODY);
});

it("returns nothing to the browser that carries the token or the user id", async () => {
  const res = await submitReview();
  const body = await res.text();

  expect([...res.headers.keys()]).toEqual(["content-type"]);
  expect(body).not.toContain(ACCESS_TOKEN);
  expect(body).not.toContain(USER_ID);
});
