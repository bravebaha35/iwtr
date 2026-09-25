import { NotificationsService } from "../notifications.service";

// The approved-ownership lookup vs. the resolved-claims lookup.
const ownsC1 = jest.fn().mockImplementation(({ where }) =>
  Promise.resolve(where.claimStatus === "APPROVED" ? [{ companyId: "c1" }] : []),
);

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
    jobApplication: { findMany: jest.fn().mockResolvedValue([]) },
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
      companyOwner: { findMany: ownsC1 },
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
  it("never sends a company owner reviewer-side message alerts (they have no personal inbox)", async () => {
    const reviewerSide = {
      id: "conv-1",
      companyId: "c2",
      reviewerLastReadSeq: 0,
      company: { name: "Old Employer", slug: "old-employer" },
      messages: [{ id: "m4", seq: 4, createdAt: day }],
    };
    const prisma = basePrisma({
      companyOwner: { findMany: ownsC1 },
      reviewConversation: {
        findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.reviewerUserId ? [reviewerSide] : [])),
      },
    });
    const events = await new NotificationsService(prisma).list("owner-1");
    expect(events.filter((e) => e.type === "CONVERSATION_MESSAGE_FROM_COMPANY")).toEqual([]);
  });
});

describe("NotificationsService.list - reviews, claims and applications", () => {
  const now = new Date("2026-09-25T10:30:00Z");

  it("tells a reviewer their review was published, and when one wasn't", async () => {
    const prisma = basePrisma({
      review: {
        findMany: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(
            where.userId
              ? [
                  {
                    id: "r1",
                    status: "PUBLISHED",
                    publishedAt: now,
                    createdAt: now,
                    company: { name: "Acme", slug: "acme" },
                  },
                  {
                    id: "r2",
                    status: "REJECTED",
                    publishedAt: null,
                    createdAt: now,
                    company: { name: "Beta", slug: "beta" },
                  },
                  {
                    id: "r3",
                    status: "PENDING_ADMIN_REVIEW",
                    publishedAt: null,
                    createdAt: now,
                    company: { name: "Gamma", slug: "gamma" },
                  },
                ]
              : [],
          ),
        ),
      },
    });
    const events = await new NotificationsService(prisma).list("u1");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "review-published-r1", type: "REVIEW_PUBLISHED", companyName: "Acme", href: "/companies/acme" }),
        expect.objectContaining({ id: "review-rejected-r2", type: "REVIEW_NOT_PUBLISHED", companyName: "Beta", href: "/me/reviews" }),
      ]),
    );
    expect(events.some((e) => e.companyName === "Gamma")).toBe(false);
  });

  it("tells a claimant their company claim was approved or not", async () => {
    const prisma = basePrisma({
      companyOwner: {
        findMany: jest.fn().mockImplementation(({ where }) =>
          Promise.resolve(
            where.claimStatus === "APPROVED"
              ? []
              : [
                  { id: "co1", claimStatus: "APPROVED", resolvedAt: now, company: { name: "Acme", slug: "acme" } },
                  { id: "co2", claimStatus: "REJECTED", resolvedAt: now, company: { name: "Beta", slug: "beta" } },
                ],
          ),
        ),
      },
    });
    const events = await new NotificationsService(prisma).list("u1");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "claim-co1", type: "CLAIM_APPROVED", companyName: "Acme", href: "/my/companies" }),
        expect.objectContaining({ id: "claim-co2", type: "CLAIM_REJECTED", companyName: "Beta", href: "/companies/beta" }),
      ]),
    );
  });

  it("tells an owner about a new CV application, linking to that company's Applications", async () => {
    const prisma = basePrisma({
      companyOwner: { findMany: ownsC1 },
      jobApplication: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "a1",
            companyId: "c1",
            createdAt: now,
            jobPosting: { jobTitle: "Forklift Operatörü" },
            company: { name: "Acme", slug: "acme" },
          },
        ]),
      },
    });
    const events = await new NotificationsService(prisma).list("owner-1");
    expect(events).toEqual([
      expect.objectContaining({
        id: "application-a1",
        type: "JOB_APPLICATION_RECEIVED",
        companyName: "Acme",
        jobTitle: "Forklift Operatörü",
        href: "/my/companies?category=applications&company=c1",
      }),
    ]);
  });

  it("tells an owner someone reviewed their company, dated to the day only", async () => {
    const reviewFindMany = jest.fn().mockImplementation(({ where }) =>
      Promise.resolve(
        where.companyId
          ? [{ id: "r9", publishedAt: now, company: { name: "Acme", slug: "acme" } }]
          : [],
      ),
    );
    const prisma = basePrisma({ companyOwner: { findMany: ownsC1 }, review: { findMany: reviewFindMany } });
    const events = await new NotificationsService(prisma).list("owner-1");
    expect(events).toEqual([
      expect.objectContaining({
        id: "company-review-r9",
        type: "COMPANY_REVIEWED",
        companyName: "Acme",
        createdAt: "2026-09-25T00:00:00.000Z",
        href: "/companies/acme",
      }),
    ]);
    // Never the owner's own review of their own company.
    const ownerQuery = reviewFindMany.mock.calls.map((c) => c[0]).find((a) => a.where.companyId);
    expect(ownerQuery.where.userId).toEqual({ not: "owner-1" });
  });

  it("doesn't look up applications or company reviews for someone who owns nothing", async () => {
    const prisma = basePrisma();
    await new NotificationsService(prisma).list("u1");
    expect((prisma as any).jobApplication.findMany).not.toHaveBeenCalled();
  });
});
