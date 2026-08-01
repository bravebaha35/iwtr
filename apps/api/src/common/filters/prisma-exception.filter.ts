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
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

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

    // eslint-disable-next-line no-console
    console.error("Unhandled Prisma error", exception);
    response.status(500).json({ statusCode: 500, message: "Internal server error" });
  }
}
