import type { Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

/**
 * For errors a background job catches itself (they never reach the request
 * error filter): written to the log as before, and sent to error monitoring
 * (src/instrument.ts; a no-op without SENTRY_DSN).
 */
export function logAndReport(logger: Logger, message: string, err: unknown): void {
  logger.error(message, err as Error);
  Sentry.captureException(err);
}
