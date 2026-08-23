import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateReviewInput } from "@iwtr/shared-types";
import { ReviewsService } from "../reviews.service";
import { ModerationService } from "../../moderation/moderation.service";
import { getQuestionsFor } from "../survey-questions.data";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code,
    clientVersion: "5.20.0",
  });
}

describe("ReviewsService.submitReview", () => {
  it("throws a friendly ConflictException when two concurrent submissions race past the duplicate-review check", async () => {
    const userId = "user-1";
    const companyId = "company-1";
    const employmentHistoryId = "emp-1";
    const questions = getQuestionsFor("OFFICE");
    const answers = questions.map((q) => ({ questionId: q.id, answer: q.correctAnswer }));

    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: userId,
          status: "ACTIVE",
          createdAt: new Date(),
        }),
      },
      employmentHistory: {
        findUnique: jest.fn().mockResolvedValue({
          id: employmentHistoryId,
          userId,
          companyId,
          company: { workplaceTypes: ["OFFICE"] },
        }),
      },
      review: {
        // Both concurrent requests observe "no existing review" before either write lands.
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockRejectedValue(prismaError("P2002")),
      },
    };
    const piiVault = { purgeTcKimlikNoIfPresent: jest.fn() };
    const service = new ReviewsService(prisma as any, new ModerationService(), piiVault as any);

    const input: CreateReviewInput = {
      companyId,
      employmentHistoryId,
      workplaceType: "OFFICE",
      answers,
      generalThoughts: "",
      isRandomizedIdentity: false,
    };

    await expect(service.submitReview(userId, input)).rejects.toThrow(
      new ConflictException("You have already reviewed this company"),
    );
    expect(piiVault.purgeTcKimlikNoIfPresent).not.toHaveBeenCalled();
  });

  it("sets isRandomizedIdentity strictly from the per-review checkbox, with no account-level override", async () => {
    const userId = "user-1";
    const companyId = "company-1";
    const employmentHistoryId = "emp-1";
    const questions = getQuestionsFor("OFFICE");
    const answers = questions.map((q) => ({ questionId: q.id, answer: q.correctAnswer }));

    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: userId,
          status: "ACTIVE",
          createdAt: new Date(),
        }),
      },
      employmentHistory: {
        findUnique: jest.fn().mockResolvedValue({
          id: employmentHistoryId,
          userId,
          companyId,
          company: { workplaceTypes: ["OFFICE"] },
        }),
      },
      review: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: "review-1" }),
      },
      moderationQueueItem: { create: jest.fn() },
      companyAggregateScore: { upsert: jest.fn() },
    };
    const piiVault = { purgeTcKimlikNoIfPresent: jest.fn() };
    const service = new ReviewsService(prisma as any, new ModerationService(), piiVault as any);

    const input: CreateReviewInput = {
      companyId,
      employmentHistoryId,
      workplaceType: "OFFICE",
      answers,
      generalThoughts: "",
      isRandomizedIdentity: false,
    };

    await service.submitReview(userId, input);

    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isRandomizedIdentity: false }) }),
    );
  });
});
