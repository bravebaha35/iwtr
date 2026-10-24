import { BadRequestException, InternalServerErrorException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ErrorEvent } from "@sentry/nestjs";
import { isServerFault } from "../error-reporting.filter";
import { scrubEvent } from "../../../instrument";

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "5.22.0" });

describe("isServerFault (what goes to error monitoring)", () => {
  it("reports crashes and 5xx answers", () => {
    expect(isServerFault(new Error("boom"))).toBe(true);
    expect(isServerFault(new InternalServerErrorException())).toBe(true);
    expect(isServerFault(new ServiceUnavailableException())).toBe(true);
    expect(isServerFault(prismaError("P2010"))).toBe(true);
  });

  it("does not report the visitor's own mistakes or expected clashes", () => {
    expect(isServerFault(new BadRequestException())).toBe(false);
    expect(isServerFault(prismaError("P2002"))).toBe(false);
    expect(isServerFault(prismaError("P2025"))).toBe(false);
  });
});

describe("scrubEvent (nothing about the person leaves)", () => {
  it("drops user, headers, cookies, body, query string and breadcrumbs", () => {
    const event = {
      type: undefined,
      user: { id: "u1", ip_address: "203.0.113.7" },
      request: {
        method: "POST",
        url: "https://api.example/v1/reviews?draft=1",
        headers: { authorization: "Bearer x", "x-forwarded-for": "203.0.113.7" },
        cookies: { a: "b" },
        data: { comment: "my manager is ..." },
        query_string: "draft=1",
      },
      breadcrumbs: [{ message: "x" }],
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);

    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.request).toEqual({ method: "POST", url: "https://api.example/v1/reviews" });
  });
});
