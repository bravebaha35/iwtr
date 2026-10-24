import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nestjs";
import { PrismaExceptionFilter } from "./prisma-exception.filter";

/**
 * The API's one global exception filter. It answers exactly as before
 * (Prisma errors through PrismaExceptionFilter, everything else Nest's own
 * way) and also sends the errors that mean something is broken on our side
 * to error monitoring (src/instrument.ts): anything that would come back as a
 * 5xx. Ordinary 4xx answers (bad input, not logged in, too many requests) are
 * the visitor's side and are not reported.
 */
@Catch()
export class ErrorReportingFilter extends BaseExceptionFilter {
  private readonly prisma = new PrismaExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost): void {
    if (isServerFault(exception)) Sentry.captureException(exception);

    if (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientInitializationError
    ) {
      this.prisma.catch(exception, host);
      return;
    }
    super.catch(exception, host);
  }
}

export function isServerFault(exception: unknown): boolean {
  if (exception instanceof HttpException) return exception.getStatus() >= 500;
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    // These three become clean 4xx answers (PrismaExceptionFilter).
    return !["P2002", "P2003", "P2025"].includes(exception.code);
  }
  return true;
}
