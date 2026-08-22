import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import type { AuthenticatedUser } from "../auth/auth.types";
import { TrafficLogService } from "./traffic-log.service";

// Fixed allowlist rather than "log everything" — Law 5651 traffic-log
// obligations apply broadly in principle, but this project only needs
// authentication, registration, and review-submission covered for now (see
// CLAUDE.md). Path strings include the global "v1" prefix (main.ts) since
// that's what's actually on the incoming request.
const LOGGED_ROUTES: ReadonlyArray<{ method: string; path: string }> = [
  { method: "POST", path: "/v1/auth/register" },
  { method: "POST", path: "/v1/auth/login" },
  { method: "POST", path: "/v1/auth/google" },
  { method: "POST", path: "/v1/auth/apple" },
  { method: "POST", path: "/v1/reviews" },
];

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class TrafficLogInterceptor implements NestInterceptor {
  constructor(private readonly trafficLog: TrafficLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const isLogged = LOGGED_ROUTES.some((route) => route.method === request.method && route.path === request.path);

    if (!isLogged) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response.statusCode),
        error: (err: { status?: number }) => this.log(request, err?.status ?? 500),
      }),
    );
  }

  private log(request: RequestWithUser, statusCode: number): void {
    // Fire-and-forget: TrafficLogService.record never throws, and we don't
    // want the response to wait on a DB write it doesn't depend on.
    void this.trafficLog.record({
      ip: request.ip ?? "unknown",
      endpoint: request.path,
      method: request.method,
      statusCode,
      userId: request.user?.id,
    });
  }
}
