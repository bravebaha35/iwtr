// Error monitoring for the web server itself (pages that fail while being
// built on the server, route handlers). Off until NEXT_PUBLIC_SENTRY_DSN is
// set. See lib/monitoring.ts for what a report may and may not contain.
import type { Instrumentation } from "next";
import { SENTRY_DSN, sentryBaseOptions } from "@/lib/monitoring";

export async function register(): Promise<void> {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init(sentryBaseOptions);
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  // The request's path only: no headers (they can carry the visitor's IP)
  // and no query string.
  Sentry.captureRequestError(error, { ...request, path: request.path.split("?")[0], headers: {} }, context);
};
