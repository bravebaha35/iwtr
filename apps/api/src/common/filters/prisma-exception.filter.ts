import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";

// A handful of services do a check-then-act read followed by a write (e.g.
// "does this slug/email/TCKN hash already exist?" then create/update) without
// wrapping both in a transaction, so a genuine concurrent race can still hit
// the underlying DB constraint. Rather than fixing every call site with a
// transaction (overkill for what are all low-contention, mostly-single-user
// races), this filter turns the resulting raw Prisma error into the same
// clean HTTP response the pre-check was trying to produce in the first place.
//
// Also catches PrismaClientInitializationError separately (the DB is
// unreachable — connection refused, wrong credentials, out of connections)
// so a real outage is distinguishable in the logs — and by a dedicated 503
// status — from an unexpected application bug, which previously both fell
// through to the same generic 500 with no way to tell them apart from either
// the response or the log line alone.
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientInitializationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientInitializationError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      // eslint-disable-next-line no-console
      console.error("[db] Database unreachable — PrismaClientInitializationError", exception);
      response.status(503).json({ statusCode: 503, message: "The database is temporarily unreachable — please try again shortly." });
      return;
    }

    if (exception.code === "P2002") {
      const mapped = new ConflictException("This action conflicts with existing data — it may already be done.");
      response.status(mapped.getStatus()).json(mapped.getResponse());
      return;
    }

    if (exception.code === "P2025") {
      const mapped = new NotFoundException("The record you're acting on no longer exists.");
      response.status(mapped.getStatus()).json(mapped.getResponse());
      return;
    }

    if (exception.code === "P2003") {
      // Foreign key violation — something this request depends on (or that
      // still depends on it) doesn't exist / can't be removed. No delete
      // endpoints exist yet for User/Company (see the audit's KVKK finding),
      // so this is currently unreachable in practice, but it's here so the
      // day one is added, a blocked delete surfaces as a clean 409 instead
      // of an unhandled 500.
      const mapped = new ConflictException(
        "This action is blocked by related data that still references it.",
      );
      response.status(mapped.getStatus()).json(mapped.getResponse());
      return;
    }

    // eslint-disable-next-line no-console
    console.error("Unhandled Prisma error", exception);
    response.status(500).json({ statusCode: 500, message: "Internal server error" });
  }
}
