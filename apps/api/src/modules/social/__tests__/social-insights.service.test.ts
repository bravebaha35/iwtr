import { ForbiddenException } from "@nestjs/common";
import { SocialInsightsService, VIEW_REPEAT_MS } from "../social-insights.service";
import { dayKey, socialDay, socialDayStart } from "../social-day.util";

const member = { id: "m1", role: "MEMBER" as const };
const DAY_MS = 24 * 60 * 60 * 1000;

function viewsPrisma(posts: { id: string; companyId: string }[]) {
  return {
    socialPost: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(posts.filter((p) => where.id.in.includes(p.id))),
      ),
      updateMany: jest.fn().mockReturnValue("post-update"),
    },
    companySocialDay: { upsert: jest.fn().mockReturnValue("day-upsert") },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

describe("SocialInsightsService.recordViews", () => {
  afterEach(() => jest.useRealTimers());

  it("adds one view to each post and to its company's day, and stores nothing about who looked", async () => {
    const prisma = viewsPrisma([
      { id: "p1", companyId: "c1" },
      { id: "p2", companyId: "c1" },
      { id: "p3", companyId: "c2" },
    ]);
    await new SocialInsightsService(prisma as never).recordViews(member, ["p1", "p2", "p3", "p1"]);

    expect(prisma.socialPost.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2", "p3"] } },
      data: { viewCount: { increment: 1 } },
    });
    const upserts = prisma.companySocialDay.upsert.mock.calls.map(([arg]) => arg);
    expect(upserts).toHaveLength(2);
    expect(upserts[0]).toEqual({
      where: { companyId_day: { companyId: "c1", day: socialDay() } },
      create: { companyId: "c1", day: socialDay(), postViews: 2 },
      update: { postViews: { increment: 2 } },
    });
    expect(upserts[1].create).toEqual({ companyId: "c2", day: socialDay(), postViews: 1 });
    // The only things written are counters: no member id in any write.
    expect(JSON.stringify([prisma.socialPost.updateMany.mock.calls, upserts])).not.toContain("m1");
  });

  it("counts the same member on the same post once, then again after the repeat window", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-14T09:00:00Z"));
    const prisma = viewsPrisma([{ id: "p1", companyId: "c1" }]);
    const service = new SocialInsightsService(prisma as never);

    await service.recordViews(member, ["p1"]);
    await service.recordViews(member, ["p1"]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // Another member is another view.
    await service.recordViews({ id: "m2", role: "MEMBER" }, ["p1"]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);

    jest.setSystemTime(Date.now() + VIEW_REPEAT_MS + 1000);
    await service.recordViews(member, ["p1"]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not count an owner or an admin", async () => {
    const prisma = viewsPrisma([{ id: "p1", companyId: "c1" }]);
    const service = new SocialInsightsService(prisma as never);
    await service.recordViews({ id: "o1", role: "COMPANY_OWNER" }, ["p1"]);
    await service.recordViews({ id: "a1", role: "ADMIN" }, ["p1"]);
    expect(prisma.socialPost.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("ignores ids that are not a visible company's post", async () => {
    const prisma = viewsPrisma([]);
    await new SocialInsightsService(prisma as never).recordViews(member, ["ghost"]);
    // Only posts of a company that is publicly visible are looked up.
    expect(prisma.socialPost.findMany.mock.calls[0][0].where.company).toEqual({ hiddenAt: null });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

function insightsPrisma(over: { ownership?: unknown; followers?: number; days?: unknown[]; top?: unknown[] } = {}) {
  return {
    companyOwner: {
      findUnique: jest
        .fn()
        .mockResolvedValue(over.ownership === undefined ? { claimStatus: "APPROVED", tier: "PRO", planStatus: "ACTIVE" } : over.ownership),
    },
    companyFollow: { count: jest.fn().mockResolvedValue(over.followers ?? 0) },
    companySocialDay: { findMany: jest.fn().mockResolvedValue(over.days ?? []) },
    socialPostLike: { count: jest.fn().mockResolvedValue(12) },
    socialComment: { count: jest.fn().mockResolvedValue(5) },
    socialPost: { count: jest.fn().mockResolvedValue(3), findMany: jest.fn().mockResolvedValue(over.top ?? []) },
  };
}

describe("socialDay", () => {
  it("is the calendar day in Turkey, which is three hours ahead of UTC", () => {
    // 22:30 UTC on the 13th is already 01:30 on the 14th in Istanbul.
    expect(dayKey(socialDay(new Date("2026-10-13T22:30:00Z")))).toBe("2026-10-14");
    expect(dayKey(socialDay(new Date("2026-10-13T20:59:00Z")))).toBe("2026-10-13");
    expect(socialDayStart(socialDay(new Date("2026-10-13T22:30:00Z"))).toISOString()).toBe("2026-10-13T21:00:00.000Z");
  });
});

describe("SocialInsightsService.insights", () => {
  it("is only for an approved owner of that company", async () => {
    for (const ownership of [null, { claimStatus: "PENDING", tier: "PRO", planStatus: "ACTIVE" }]) {
      const prisma = insightsPrisma({ ownership });
      await expect(new SocialInsightsService(prisma as never).insights("u1", "c1", 30)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.companyFollow.count).not.toHaveBeenCalled();
    }
  });

  it("reaches as far back as the plan allows, and a lapsed plan counts as Free", async () => {
    const cases: [unknown, number | undefined, number, number][] = [
      [{ claimStatus: "APPROVED", tier: "FREE", planStatus: "ACTIVE" }, 365, 7, 7],
      [{ claimStatus: "APPROVED", tier: "STARTER", planStatus: "ACTIVE" }, 90, 30, 30],
      [{ claimStatus: "APPROVED", tier: "PRO", planStatus: "ACTIVE" }, 7, 7, 90],
      [{ claimStatus: "APPROVED", tier: "ENTERPRISE", planStatus: "ACTIVE" }, 365, 365, 365],
      [{ claimStatus: "APPROVED", tier: "ENTERPRISE", planStatus: "CANCELED" }, 365, 7, 7],
      // Not one of the offered periods: 30 days, cut to the plan.
      [{ claimStatus: "APPROVED", tier: "PRO", planStatus: "ACTIVE" }, 12, 30, 90],
      [{ claimStatus: "APPROVED", tier: "PRO", planStatus: "ACTIVE" }, undefined, 30, 90],
    ];
    for (const [ownership, asked, days, maxDays] of cases) {
      const result = await new SocialInsightsService(insightsPrisma({ ownership }) as never).insights("u1", "c1", asked);
      expect([result.days, result.maxDays, result.series.length]).toEqual([days, maxDays, days]);
    }
  });

  it("works the followers line back from today's count, day by day", async () => {
    const today = socialDay();
    const ago = (n: number) => new Date(today.getTime() - n * DAY_MS);
    const prisma = insightsPrisma({
      followers: 10,
      days: [
        { day: ago(0), postViews: 4, followersGained: 2, followersLost: 0 },
        { day: ago(2), postViews: 7, followersGained: 1, followersLost: 3 },
      ],
    });
    const result = await new SocialInsightsService(prisma as never).insights("u1", "c1", 7);

    expect(result.followers).toEqual({ now: 10, gained: 3, lost: 3 });
    expect(result.views).toBe(11);
    expect([result.reactions, result.comments, result.posts]).toEqual([12, 5, 3]);
    // Oldest first, ending today. Today 10; yesterday 8 (2 came today); the
    // day before that 8; before that 10 (1 came and 3 left two days ago).
    expect(result.series.map((d) => d.followers)).toEqual([10, 10, 10, 10, 8, 8, 10]);
    expect(result.series.map((d) => d.views)).toEqual([0, 0, 0, 0, 7, 0, 4]);
    expect(result.series[6].day).toBe(dayKey(today));
    expect(result.series[0].day).toBe(dayKey(ago(6)));
  });

  it("lists the period's posts by views, with counts only", async () => {
    const prisma = insightsPrisma({
      top: [
        {
          id: "p1",
          kind: "MILESTONE",
          caption: null,
          title: "10 years",
          imageUrls: ["a.webp", "b.webp"],
          createdAt: new Date("2026-10-13T09:41:12Z"),
          viewCount: 40,
          _count: { likes: 6, comments: 2 },
        },
      ],
    });
    const result = await new SocialInsightsService(prisma as never).insights("u1", "c1", 30);
    expect(result.topPosts).toEqual([
      {
        postId: "p1",
        kind: "MILESTONE",
        text: "10 years",
        thumbUrl: "a.webp",
        // Rounded to the hour, like every post time a company is shown.
        createdAt: "2026-10-13T09:00:00.000Z",
        views: 40,
        reactions: 6,
        comments: 2,
      },
    ]);
    expect(prisma.socialPost.findMany.mock.calls[0][0].orderBy[0]).toEqual({ viewCount: "desc" });
    // Counts only: nothing asks for a member's id.
    const reads = [prisma.socialPostLike.count, prisma.socialComment.count, prisma.companyFollow.count, prisma.socialPost.findMany];
    expect(JSON.stringify(reads.map((r) => r.mock.calls))).not.toMatch(/userId|authorUserId/);
  });
});
