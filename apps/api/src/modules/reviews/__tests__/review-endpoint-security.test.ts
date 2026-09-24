import { BadRequestException } from "@nestjs/common";
import { createReviewInputSchema, updateReviewInputSchema } from "@iwtr/shared-types";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { toUtcDay } from "../../../common/time/day-precision.util";
import { ModerationService } from "../../moderation/moderation.service";
import { ReviewsService } from "../reviews.service";
import { getQuestionsFor } from "../survey-questions.data";

// The exact pipes POST /reviews and PATCH /reviews/:id use (strict mode).
const createPipe = new ZodValidationPipe(createReviewInputSchema, { strict: true });
const updatePipe = new ZodValidationPipe(updateReviewInputSchema, { strict: true });

const answers = getQuestionsFor("OFFICE").map((q) => ({ questionId: q.id, answer: q.correctAnswer }));
function validBody(): Record<string, unknown> {
  return {
    companyId: "7a0c1e1e-0000-4000-8000-000000000001",
    employmentHistoryId: "7a0c1e1e-0000-4000-8000-000000000002",
    workplaceType: "OFFICE",
    // A fresh copy each time — some tests tamper with an answer.
    answers: answers.map((x) => ({ ...x })),
    isRandomizedIdentity: false,
    compensation: { hasConsentedToCommercialBenchmarking: true, monthlyNetSalary: "45.000", benefits: ["MEAL_CARD"] },
  };
}
// What a raw HTTP body looks like after Express's JSON parser.
const asParsedJson = (body: unknown) => JSON.parse(JSON.stringify(body));

describe("anonymous review endpoint — payload hardening", () => {
  it("accepts the exact shape the review form sends", () => {
    expect(() => createPipe.transform(asParsedJson(validBody()))).not.toThrow();
  });

  it.each([
    ["an unexpected top-level field", { userId: "someone-else" }],
    ["a client-chosen status", { status: "PUBLISHED" }],
    ["an IP / tracking field", { ip: "203.0.113.7", userAgent: "Mozilla/5.0" }],
    ["a client-chosen timestamp", { createdAt: "2026-09-24T14:03:00Z" }],
  ])("rejects %s", (_label, extra) => {
    expect(() => createPipe.transform(asParsedJson({ ...validBody(), ...extra }))).toThrow(BadRequestException);
  });

  it("rejects unexpected fields nested inside an answer and inside the salary block", () => {
    const body = validBody();
    (body.answers as Record<string, unknown>[])[0] = { ...answers[0], score: 5 };
    expect(() => createPipe.transform(asParsedJson(body))).toThrow(BadRequestException);

    const salary = validBody();
    (salary.compensation as Record<string, unknown>).employerName = "Acme";
    expect(() => createPipe.transform(asParsedJson(salary))).toThrow(BadRequestException);
  });

  it("rejects prototype-pollution keys", () => {
    const polluted = JSON.parse(`{"__proto__": {"isAdmin": true}, ${JSON.stringify(validBody()).slice(1)}`);
    expect(() => createPipe.transform(polluted)).toThrow(BadRequestException);
  });

  it.each([
    ["an array where one id is expected (parameter pollution)", { companyId: ["7a0c1e1e-0000-4000-8000-000000000001", "x"] }],
    ["an SQL-injection id", { companyId: "1' OR '1'='1" }],
    ["an injected workplace type", { workplaceType: "OFFICE'; DROP TABLE \"Review\";--" }],
    ["an object where a boolean is expected", { isRandomizedIdentity: { $ne: false } }],
    ["too few answers", { answers: answers.slice(1) }],
    ["an oversized comment", { generalThoughts: "x".repeat(4001) }],
  ])("rejects %s", (_label, override) => {
    expect(() => createPipe.transform(asParsedJson({ ...validBody(), ...override }))).toThrow(BadRequestException);
  });

  it("applies the same strictness to edits", () => {
    const { companyId: _c, employmentHistoryId: _e, workplaceType: _w, ...edit } = validBody();
    expect(() => updatePipe.transform(asParsedJson(edit))).not.toThrow();
    expect(() => updatePipe.transform(asParsedJson({ ...edit, companyId: "7a0c1e1e-0000-4000-8000-000000000009" }))).toThrow(
      BadRequestException,
    );
  });
});

describe("anonymous review endpoint — what gets stored", () => {
  it("stores no IP, no user agent and no exact time: createdAt is left to the day-precision DB default, publishedAt is the UTC day", async () => {
    const userId = "user-1";
    const prisma: Record<string, any> = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, status: "ACTIVE", createdAt: new Date(0) }) },
      employmentHistory: {
        findUnique: jest.fn().mockResolvedValue({
          id: "7a0c1e1e-0000-4000-8000-000000000002",
          userId,
          companyId: "7a0c1e1e-0000-4000-8000-000000000001",
          company: { workplaceTypes: ["OFFICE"], structureType: "SETTLED", city: null, region: null },
        }),
      },
      review: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: "review-1" }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      salarySubmission: { create: jest.fn() },
      moderationQueueItem: { create: jest.fn() },
      companyAggregateScore: { upsert: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(prisma));
    const service = new ReviewsService(prisma as never, new ModerationService(), { purgeTcKimlikNoIfPresent: jest.fn() } as never);

    const input = createPipe.transform(asParsedJson(validBody()));
    await service.submitReview(userId, input as never);

    const { data } = prisma.review.create.mock.calls[0][0];
    expect(Object.keys(data)).not.toEqual(expect.arrayContaining(["ip", "userAgent", "createdAt"]));
    expect(data).not.toHaveProperty("createdAt");
    if (data.publishedAt) expect(data.publishedAt).toEqual(toUtcDay());
    const salary = prisma.salarySubmission.create.mock.calls[0][0].data;
    expect(salary).not.toHaveProperty("createdAt");
    expect(JSON.stringify([data, salary])).not.toMatch(/203\.0\.113|Mozilla/);
  });
});

describe("toUtcDay", () => {
  it("drops everything below the UTC day", () => {
    expect(toUtcDay(new Date("2026-09-24T14:03:27.123Z")).toISOString()).toBe("2026-09-24T00:00:00.000Z");
  });
});
