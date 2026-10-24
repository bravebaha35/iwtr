// Error monitoring (Sentry). Imported first thing in main.ts so it can see
// every error. Does nothing until SENTRY_DSN is set.
//
// This site promises reviewers anonymity, so an error report carries the
// error and where in the code it happened, and nothing about the person:
// no IP address, no user, no cookies or headers, no request body or query
// string. scrubEvent below enforces that on every report.
import * as Sentry from "@sentry/nestjs";
import type { ErrorEvent } from "@sentry/nestjs";

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    const url = event.request.url ? event.request.url.split("?")[0] : undefined;
    event.request = { method: event.request.method, url };
  }
  // Server name and the like can stay; anything that came from the visitor goes.
  delete event.breadcrumbs;
  return event;
}

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    // Collect nothing about the person or the request contents.
    dataCollection: {
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
    },
    // Errors only: no performance tracing (no extra load on every request).
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
  });
}

export const monitoringEnabled = Boolean(dsn);
