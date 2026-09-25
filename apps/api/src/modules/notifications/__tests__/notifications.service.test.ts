import { NotificationsService } from "../notifications.service";

function basePrisma(overrides: Record<string, unknown> = {}) {
  return {
    review: { findMany: jest.fn().mockResolvedValue([]) },
    reviewVote: { findMany: jest.fn().mockResolvedValue([]) },
    companyReply: { findMany: jest.fn().mockResolvedValue([]) },
    jobPosting: { findMany: jest.fn().mockResolvedValue([]) },
    companyFollow: { findMany: jest.fn().mockResolvedValue([]) },
    companyAggregateScore: { findMany: jest.fn().mockResolvedValue([]) },
    socialPost: { findMany: jest.fn().mockResolvedValue([]) },
    benchmarkReportJob: { findMany: jest.fn().mockResolvedValue([]) },
    companyOwner: { findMany: jest.fn().mockResolvedValue([]) },
    reviewConversation: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as never;
}

describe("NotificationsService.list - followed-company events", () => {
  it("returns no COMPANY_* events for a user who follows nothing", async () => {
    const prisma = basePrisma();
    const events = await new NotificationsService(prisma).list("u1");
    expect(events).toEqual([]);
    // No follow rows -> the 3 followed-company queries never even run.
    expect((prisma as any).companyAggregateScore.findMany).not.toHaveBeenCalled();
  });

  it("derives a COMPANY_STATUS_UPDATE from a followed company's aggregate score", async () => {
    const prisma = basePrisma({
      companyFollow: { findMany: jest.fn().mockResolvedValue([{ companyId: "c1" }]) },
      companyAggregateScore: {
        findMany: jest.fn().mockResolvedValue([
          { companyId: "c1", updatedAt: new Date("2026-01-01T00:00:00Z"), company: { name: "Acme", slug: "acme" } },
        ]),
      },
    });
    const events = await new NotificationsService(prisma).list("u1");
    expect(events).toEqual([
      expect.objectContaining({ type: "COMPANY_STATUS_UPDATE", companyName: "Acme", companySlug: "acme" }),
    ]);
  });

  it("derives a COMPANY_NEW_SOCIAL_POST from a followed company's post", async () => {
    const prisma = basePrisma({
      companyFollow: { findMany: jest.fn().mockResolvedValue([{ companyId: "c1" }]) },
      socialPost: {
        findMany: jest.fn().mockResolvedValue([
          { id: "p1", createdAt: new Date("2026-01-01T00:00:00Z"), company: { name: "Acme", slug: "acme" } },
        ]),
      },
    });
    const events = await new NotificationsService(prisma).list("u1");
    expect(events).toEqual([
      expect.objectContaining({ type: "COMPANY_NEW_SOCIAL_POST", companyName: "Acme", companySlug: "acme" }),
    ]);
  });

  it("derives a COMPANY_HIRING event only from a PUBLISHED job posting", async () => {
    // Args-aware mock: the caller's-own-postings query (createdByUserId)
    // and the followed-companies query (companyId + status) are two
    // independent calls to the same prisma method - return different rows
    // for each so this test can tell them apart.
    const jobPostingFindMany = jest.fn().mockImplementation((args: any) => {
      if (args.where.companyId) {
        return Promise.resolve([
          {
            id: "j1",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            // Still genuinely live: PUBLISHED, freshly (re)shared, never
            // filled — daysRemaining() > 0 is what keeps this event past
            // the notifications.service.ts lapsed-posting filter.
            status: "PUBLISHED",
            lastResharedAt: new Date(),
            filledAt: null,
            autoReshareEnabled: false,
            company: { name: "Acme", slug: "acme" },
          },
        ]);
      }
      return Promise.resolve([]);
    });
    const prisma = basePrisma({
      companyFollow: { findMany: jest.fn().mockResolvedValue([{ companyId: "c1" }]) },
      jobPosting: { findMany: jobPostingFindMany },
    });
    const events = await new NotificationsService(prisma).list("u1");

    expect(jobPostingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: { in: ["c1"] }, status: "PUBLISHED" }) }),
    );
    expect(events).toEqual([
      expect.objectContaining({ type: "COMPANY_HIRING", companyName: "Acme", companySlug: "acme" }),
    ]);
  });

  it("excludes a followed company's events once that company is hidden", async () => {
    const aggFindMany = jest.fn().mockResolvedValue([]);
    const postFindMany = jest.fn().mockResolvedValue([]);
    const prisma = basePrisma({
      companyFollow: { findMany: jest.fn().mockResolvedValue([{ companyId: "c1" }]) },
      companyAggregateScore: { findMany: aggFindMany },
      socialPost: { findMany: postFindMany },
    });
    await new NotificationsService(prisma).list("u1");

    expect(aggFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ company: { hiddenAt: null } }) }),
    );
    expect(postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ company: { hiddenAt: null } }) }),
    );
  });

  it("merges followed-company events with the caller's own review-vote events, newest first", async () => {
    const prisma = basePrisma({
      review: { findMany: jest.fn().mockResolvedValue([{ id: "r1", company: { name: "Own", slug: "own" } }]) },
      reviewVote: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: "v1", reviewId: "r1", value: 1, createdAt: new Date("2020-01-01T00:00:00Z") }]),
      },
      companyFollow: { findMany: jest.fn().mockResolvedValue([{ companyId: "c1" }]) },
      companyAggregateScore: {
        findMany: jest.fn().mockResolvedValue([
          { companyId: "c1", updatedAt: new Date("2026-01-01T00:00:00Z"), company: { name: "Acme", slug: "acme" } },
        ]),
      },
    });
    const events = await new NotificationsService(prisma).list("u1");
    expect(events.map((e) => e.type)).toEqual(["COMPANY_STATUS_UPDATE", "VOTE_HELPFUL"]);
  });
});

describe("NotificationsService.list - review conversations", () => {
  const day = new Date("2026-09-25T00:00:00Z");

  it("tells the reviewer about an unread company message, linking to their Messages tab", async () => {
    const prisma = basePrisma({
      reviewConversation: {
        findMany: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(
            where.reviewerUserId === "u1"
              ? [
                  {
                    id: "conv-1",
                    companyId: "c1",
                    reviewerLastReadSeq: 3,
                    company: { name: "Acme", slug: "acme" },
                    messages: [{ id: "m4", seq: 4, createdAt: day }],
                  },
                  {
                    id: "conv-2",
                    companyId: "c2",
                    reviewerLastReadSeq: 9,
                    company: { name: "Read Co", slug: "read-co" },
                    messages: [{ id: "m8", seq: 8, createdAt: day }],
                  },
                ]
              : [],
          ),
        ),
      },
    });
    const events = await new NotificationsService(prisma).list("u1");
    expect(events).toEqual([
      expect.objectContaining({
        type: "CONVERSATION_MESSAGE_FROM_COMPANY",
        companyName: "Acme",
        href: "/me?tab=messages&c=conv-1",
      }),
    ]);
  });

  it("tells an approved owner about an unread reviewer message, linking to the company inbox", async () => {
    const prisma = basePrisma({
      companyOwner: { findMany: jest.fn().mockResolvedValue([{ companyId: "c1" }]) },
      reviewConversation: {
        findMany: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(
            where.companyId
              ? [
                  {
                    id: "conv-9",
                    companyId: "c1",
                    companyLastReadSeq: 0,
                    company: { name: "Acme", slug: "acme" },
                    messages: [{ id: "m1", seq: 1, createdAt: day }],
                  },
                ]
              : [],
          ),
        ),
      },
    });
    const events = await new NotificationsService(prisma).list("owner-1");
    expect(events).toEqual([
      expect.objectContaining({
        type: "CONVERSATION_MESSAGE_FROM_REVIEWER",
        companyName: "Acme",
        href: "/my/companies?category=messages&company=c1&c=conv-9",
      }),
    ]);
  });
});
