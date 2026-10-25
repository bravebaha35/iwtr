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
    hrAnalyticsReportJob: { findMany: jest.fn().mockResolvedValue([]) },
    companyOwner: { findMany: jest.fn().mockResolvedValue([]) },
    reviewConversation: { findMany: jest.fn().mockResolvedValue([]) },
    jobApplication: { findMany: jest.fn().mockResolvedValue([]) },
    socialAnswer: { findMany: jest.fn().mockResolvedValue([]) },
    socialQuestion: { findMany: jest.fn().mockResolvedValue([]) },
    scheduledSocialPost: { findMany: jest.fn().mockResolvedValue([]) },
    notificationRead: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
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
    // A vote opens the voted-on review itself, which the company page pulses.
    expect(events[1].href).toBe("/companies/own?review=r1");
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
        href: "/social?openChat=conv-1",
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
        href: "/social?openChat=conv-9",
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
        expect.objectContaining({ id: "review-published-r1", type: "REVIEW_PUBLISHED", companyName: "Acme", href: "/companies/acme?review=r1" }),
        expect.objectContaining({ id: "review-rejected-r2", type: "REVIEW_NOT_PUBLISHED", companyName: "Beta", href: "/me/reviews?review=r2" }),
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
        href: "/companies/acme?review=r9",
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

describe("NotificationsService - read state", () => {
  const reply = { id: "r1", reviewId: "rev1", createdAt: new Date("2026-01-02T00:00:00Z") };
  const withReplies = (readIds: string[]) =>
    basePrisma({
      review: {
        findMany: jest.fn().mockResolvedValue([
          { id: "rev1", status: "PUBLISHED", publishedAt: null, createdAt: new Date(), company: { name: "Acme", slug: "acme" } },
        ]),
      },
      companyReply: { findMany: jest.fn().mockResolvedValue([reply]) },
      notificationRead: {
        findMany: jest.fn().mockResolvedValue(readIds.map((notificationId) => ({ notificationId }))),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });

  it("marks events this account already read, scoped to the caller", async () => {
    const prisma = withReplies(["reply-r1"]);
    const events = await new NotificationsService(prisma).list("u1");
    expect(events.find((e) => e.id === "reply-r1")?.read).toBe(true);
    expect((prisma as any).notificationRead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "u1" }) }),
    );
  });

  it("leaves unread events unread", async () => {
    const events = await new NotificationsService(withReplies([])).list("u1");
    expect(events.find((e) => e.id === "reply-r1")?.read).toBe(false);
  });

  it("stores read ids once per account, ignoring repeats", async () => {
    const prisma = withReplies([]);
    await new NotificationsService(prisma).markRead("u1", ["reply-r1", "reply-r1", "vote-v1"]);
    expect((prisma as any).notificationRead.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "u1", notificationId: "reply-r1" },
        { userId: "u1", notificationId: "vote-v1" },
      ],
      skipDuplicates: true,
    });
  });
});

describe("NotificationsService.list - IWT Social questions", () => {
  const at = new Date("2026-10-13T09:41:00Z");

  it("tells the asker about an answer, to the hour, and links to the question", async () => {
    const answerFindMany = jest.fn().mockResolvedValue([
      { id: "a1", questionId: "q1", createdAt: at, question: { company: { name: "Acme", slug: "acme" } } },
      // Put to a kind of work: no company to name.
      { id: "a2", questionId: "q2", createdAt: at, question: { company: null } },
    ]);
    const prisma = basePrisma({ socialAnswer: { findMany: answerFindMany } });
    const events = await new NotificationsService(prisma).list("u1");

    expect(events).toHaveLength(2);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "question-answer-a1", type: "QUESTION_ANSWERED", companyName: "Acme", href: "/social/questions/q1" }),
      expect.objectContaining({ id: "question-answer-a2", type: "QUESTION_ANSWERED", companyName: "", companySlug: null, href: "/social/questions/q2" }),
    ]));
    expect(events[0].createdAt).toBe("2026-10-13T09:00:00.000Z");
    // Only answers to the caller's own questions, never the caller's own answer.
    expect(answerFindMany.mock.calls[0][0].where).toMatchObject({ question: { authorUserId: "u1" }, authorUserId: { not: "u1" } });
    // Not an owner: no "someone asked your company" lookup at all.
    expect((prisma as any).socialQuestion.findMany).not.toHaveBeenCalled();
  });

  it("tells an approved owner about a question put to their company", async () => {
    const questionFindMany = jest.fn().mockResolvedValue([{ id: "q9", companyId: "c1", createdAt: at, company: { name: "Acme", slug: "acme" } }]);
    const prisma = basePrisma({ companyOwner: { findMany: ownsC1 }, socialQuestion: { findMany: questionFindMany } });
    const events = await new NotificationsService(prisma).list("owner-1");

    expect(events).toContainEqual(
      // Opens the dashboard's Questions section, where it is answered and then hidden or shown.
      expect.objectContaining({
        id: "company-question-q9",
        type: "COMPANY_QUESTION_ASKED",
        companyName: "Acme",
        href: "/my/companies?company=c1&category=questions",
      }),
    );
    expect(questionFindMany.mock.calls[0][0].where.companyId).toEqual({ in: ["c1"] });
  });

  it("tells an approved owner when a scheduled post could not go out, and nobody else", async () => {
    const failedFindMany = jest
      .fn()
      .mockResolvedValue([{ id: "s1", companyId: "c1", publishAt: new Date("2026-10-12T06:00:00Z"), company: { name: "Acme", slug: "acme" } }]);
    const prisma = basePrisma({ companyOwner: { findMany: ownsC1 }, scheduledSocialPost: { findMany: failedFindMany } });
    const events = await new NotificationsService(prisma).list("owner-1");

    expect(events).toContainEqual(
      expect.objectContaining({
        id: "scheduled-post-failed-s1",
        type: "SCHEDULED_POST_FAILED",
        companyName: "Acme",
        createdAt: "2026-10-12T06:00:00.000Z",
        href: "/my/companies?company=c1&category=social",
      }),
    );
    expect(failedFindMany.mock.calls[0][0].where).toEqual({ companyId: { in: ["c1"] }, status: "FAILED" });

    // Someone who owns no company is never asked about.
    const member = basePrisma({ scheduledSocialPost: { findMany: failedFindMany } });
    failedFindMany.mockClear();
    await new NotificationsService(member).list("u1");
    expect(failedFindMany).not.toHaveBeenCalled();
  });

  it("says nothing about questions while the feature is switched off", async () => {
    process.env.SOCIAL_QUESTIONS_ENABLED = "false";
    try {
      const prisma = basePrisma();
      await new NotificationsService(prisma).list("u1");
      expect((prisma as any).socialAnswer.findMany).not.toHaveBeenCalled();
    } finally {
      delete process.env.SOCIAL_QUESTIONS_ENABLED;
    }
  });
});

describe("NotificationsService.list - RATED_COMPANY_IMPROVING", () => {
  const publishedAt = new Date("2026-06-01T10:00:00Z");
  // The caller's own review: an overall of 2.0.
  const myReview = {
    id: "r1",
    status: "PUBLISHED",
    publishedAt,
    createdAt: publishedAt,
    companyId: "c9",
    corporateCultureScore: 2,
    leadershipScore: 2,
    infrastructureScore: 2,
    workLifeBalanceScore: 2,
    stabilityScore: 2,
    company: { name: "Rising Co", slug: "rising-co" },
  };

  function setup(opts: { nowAvg: number; nowCount: number; thenAvg: number; thenCount: number; myScore?: number }) {
    const score = opts.myScore ?? 2;
    const avg = { corporateCultureScore: opts.thenAvg, leadershipScore: opts.thenAvg, infrastructureScore: opts.thenAvg, workLifeBalanceScore: opts.thenAvg, stabilityScore: opts.thenAvg };
    const prisma = basePrisma({
      review: {
        findMany: jest.fn().mockResolvedValue([
          { ...myReview, corporateCultureScore: score, leadershipScore: score, infrastructureScore: score, workLifeBalanceScore: score, stabilityScore: score },
        ]),
        aggregate: jest.fn().mockResolvedValue({ _avg: avg, _count: { _all: opts.thenCount } }),
      },
      companyAggregateScore: {
        findMany: jest.fn().mockResolvedValue([
          { companyId: "c9", overallAvg: opts.nowAvg, reviewCount: opts.nowCount, updatedAt: new Date("2026-10-20T15:30:00Z") },
        ]),
      },
    });
    return new NotificationsService(prisma).list("u1");
  }

  it("tells the reviewer when the company has clearly risen since they rated it", async () => {
    const events = await setup({ nowAvg: 3.6, nowCount: 9, thenAvg: 2.8, thenCount: 4 });
    const rise = events.find((e) => e.type === "RATED_COMPANY_IMPROVING");
    expect(rise).toMatchObject({
      id: "rating-up-r1-7",
      companyName: "Rising Co",
      href: "/companies/rising-co?review=r1",
      // Day precision: it never points at the hour a new review came in.
      createdAt: "2026-10-20T00:00:00.000Z",
    });
  });

  it("stays quiet for a small rise, too few new reviews, or when their own score is already higher", async () => {
    expect((await setup({ nowAvg: 3.0, nowCount: 9, thenAvg: 2.8, thenCount: 4 })).some((e) => e.type === "RATED_COMPANY_IMPROVING")).toBe(false);
    expect((await setup({ nowAvg: 3.6, nowCount: 6, thenAvg: 2.8, thenCount: 4 })).some((e) => e.type === "RATED_COMPANY_IMPROVING")).toBe(false);
    expect((await setup({ nowAvg: 3.6, nowCount: 9, thenAvg: 2.8, thenCount: 4, myScore: 4 })).some((e) => e.type === "RATED_COMPANY_IMPROVING")).toBe(false);
  });
});
