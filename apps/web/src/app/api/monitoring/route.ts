import { NextRequest, NextResponse } from "next/server";
import { SENTRY_DSN } from "@/lib/monitoring";

// The browser's error reports come here instead of going to Sentry directly
// (lib/monitoring.ts), and this server passes them on. Two reasons: Sentry
// never sees a visitor's IP address (only this server's), and the page needs
// no outside address in its security policy.
//
// Only reports for our own Sentry project are passed on, so this can't be
// used to send anything anywhere else, and oversized bodies are refused.
const MAX_BODY_BYTES = 200_000;

function parseDsn(dsn: string): { host: string; projectId: string } | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "");
    return projectId ? { host: url.host, projectId } : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ours = SENTRY_DSN ? parseDsn(SENTRY_DSN) : null;
  if (!ours) return new NextResponse(null, { status: 404 });

  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  // An envelope's first line is a JSON header naming the DSN it is for.
  const text = new TextDecoder().decode(body);
  let header: { dsn?: string };
  try {
    header = JSON.parse(text.slice(0, text.indexOf("\n")));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const target = header.dsn ? parseDsn(header.dsn) : null;
  if (!target || target.host !== ours.host || target.projectId !== ours.projectId) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const upstream = await fetch(`https://${ours.host}/api/${ours.projectId}/envelope/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
    });
    return new NextResponse(null, { status: upstream.ok ? 200 : 502 });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
