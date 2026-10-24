// Error monitoring (Sentry) settings shared by the browser and the web server.
// Everything is off until NEXT_PUBLIC_SENTRY_DSN is set.
//
// This site promises reviewers anonymity, so a report carries the error and
// where in the code it happened, nothing about the person: no IP, no user,
// no cookies, headers, request bodies or query strings, no breadcrumbs of
// what they clicked or typed, no session recording. The browser never talks
// to Sentry directly either: reports go through our own /api/monitoring
// route (app/api/monitoring/route.ts), so Sentry never sees a visitor's IP.
import type { ErrorEvent } from "@sentry/nextjs";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
export const MONITORING_TUNNEL = "/api/monitoring";

export const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
};

function stripQuery(url: string | undefined): string | undefined {
  return url ? url.split("?")[0].split("#")[0] : url;
}

/** Last line of defence: whatever an integration added about the person goes. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.breadcrumbs;
  if (event.request) {
    event.request = { method: event.request.method, url: stripQuery(event.request.url) };
  }
  return event;
}

export const sentryBaseOptions = {
  dsn: SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  dataCollection: DATA_COLLECTION,
  // Errors only: no performance tracing.
  tracesSampleRate: 0,
  maxBreadcrumbs: 0,
  beforeSend: (event: ErrorEvent) => scrubEvent(event),
};

/**
 * Report an error caught by one of our own error screens. Loads the Sentry
 * code only when monitoring is switched on, so visitors download nothing
 * extra while it is off.
 */
export function reportError(error: unknown): void {
  if (!SENTRY_DSN) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
}
