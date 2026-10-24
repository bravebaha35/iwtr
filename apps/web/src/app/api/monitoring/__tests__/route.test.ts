/** @jest-environment node */
import { NextRequest } from "next/server";

const OUR_DSN = "https://publickey@o123.ingest.de.sentry.io/4567";

function envelope(dsn: string, extra = "") {
  return `${JSON.stringify({ dsn, sent_at: "2026-10-24T00:00:00Z" })}\n{"type":"event"}\n{"message":"boom"}${extra}`;
}

function post(body: string) {
  return new NextRequest("http://localhost:3000/api/monitoring", { method: "POST", body });
}

async function loadRoute(dsn: string | undefined) {
  jest.resetModules();
  if (dsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;
  return import("../route");
}

let fetchMock: jest.Mock;
beforeEach(() => {
  fetchMock = jest.fn(async () => new Response(null, { status: 200 }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

it("passes our own project's reports on to Sentry, from this server", async () => {
  const { POST } = await loadRoute(OUR_DSN);
  const res = await POST(post(envelope(OUR_DSN)));

  expect(res.status).toBe(200);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://o123.ingest.de.sentry.io/api/4567/envelope/");
  // Nothing about the visitor is added on the way.
  expect(init.headers).toEqual({ "Content-Type": "application/x-sentry-envelope" });
});

it("refuses reports for any other project or host (not an open relay)", async () => {
  const { POST } = await loadRoute(OUR_DSN);
  expect((await POST(post(envelope("https://k@o123.ingest.de.sentry.io/9999")))).status).toBe(400);
  expect((await POST(post(envelope("https://k@evil.example/4567")))).status).toBe(400);
  expect((await POST(post("not an envelope"))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("refuses oversized bodies", async () => {
  const { POST } = await loadRoute(OUR_DSN);
  const res = await POST(post(envelope(OUR_DSN, "x".repeat(250_000))));
  expect(res.status).toBe(413);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("does nothing while monitoring is switched off", async () => {
  const { POST } = await loadRoute(undefined);
  expect((await POST(post(envelope(OUR_DSN)))).status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});
