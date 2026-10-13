import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { SocialScheduleService } from "../social-schedule.service";
import { SocialScheduleWorker } from "../social-schedule.worker";
import type { PreparedSocialPost } from "../social.service";

const CID = "11111111-1111-1111-1111-111111111111";
const inMinutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const inDays = (n: number) => inMinutes(n * 24 * 60);

const prepared: PreparedSocialPost = {
  companyId: CID,
  kind: "UPDATE",
  caption: "We moved offices.",
  title: null,
  eventStartsAt: null,
  eventLocation: null,
  pollOptions: [],
  pollDays: null,
  jobPostingId: null,
  imageUrls: ["http://x/uploads/social/a.webp"],
  imageAspectRatios: [1.5],
};

function row(over: Record<string, unknown> = {}) {
  return {
    id: "s1",
    companyId: CID,
    authorUserId: "u1",
    publishAt: new Date(Date.now() - 60_000),
    status: "SCHEDULED",
    payload: {
      kind: "UPDATE",
      caption: "We moved offices.",
      title: null,
      eventStartsAt: null,
      eventLocation: null,
      pollOptions: [],
      pollDays: null,
      jobPostingId: null,
    },
    imageUrls: ["http://x/uploads/social/a.webp"],
    imageAspectRatios: [1.5],
    failureReason: null,
    ...over,
  };
}

function setup(over: { ownership?: unknown; waiting?: number; found?: unknown; due?: unknown[]; claimed?: number; owners?: number; liveJob?: boolean } = {}) {
  const tx = { scheduledSocialPost: { deleteMany: jest.fn().mockResolvedValue({ count: over.claimed ?? 1 }) } };
  const prisma = {
    companyOwner: {
      findUnique: jest
        .fn()
        .mockResolvedValue(over.ownership === undefined ? { claimStatus: "APPROVED", tier: "STARTER", planStatus: "ACTIVE" } : over.ownership),
      count: jest.fn().mockResolvedValue(over.owners ?? 1),
    },
    scheduledSocialPost: {
      count: jest.fn().mockResolvedValue(over.waiting ?? 0),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "s1", status: "SCHEDULED", failureReason: null, ...data }),
      ),
      findUnique: jest.fn().mockResolvedValue(over.found === undefined ? row() : over.found),
      findMany: jest.fn().mockResolvedValue(over.due ?? []),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...row(), ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockImplementation((work: (t: typeof tx) => unknown) => work(tx)),
  };
  const social = {
    prepareNewPost: jest.fn().mockResolvedValue(prepared),
    publishPrepared: jest.fn().mockResolvedValue({ id: "post-1" }),
    isLiveJobOf: jest.fn().mockResolvedValue(over.liveJob ?? true),
    unlinkImages: jest.fn().mockResolvedValue(undefined),
  };
  return { prisma, social, tx, service: new SocialScheduleService(prisma as never, social as never) };
}

describe("SocialScheduleService.schedule", () => {
  it("keeps the post as a waiting row, not as a post", async () => {
    const { service, prisma, social } = setup();
    const publishAt = inDays(2);
    const result = await service.schedule("u1", { companyId: CID, caption: "We moved offices.", publishAt }, []);

    // The post's own checks run against the moment it will go out.
    expect(social.prepareNewPost).toHaveBeenCalledWith("u1", expect.objectContaining({ companyId: CID }), [], new Date(publishAt));
    expect(social.publishPrepared).not.toHaveBeenCalled();
    expect(prisma.scheduledSocialPost.create.mock.calls[0][0].data).toMatchObject({
      companyId: CID,
      authorUserId: "u1",
      publishAt: new Date(publishAt),
      imageUrls: prepared.imageUrls,
      payload: { kind: "UPDATE", caption: "We moved offices.", pollDays: null },
    });
    expect(result).toEqual({
      id: "s1",
      companyId: CID,
      kind: "UPDATE",
      publishAt,
      status: "SCHEDULED",
      failureReason: null,
      caption: "We moved offices.",
      title: null,
      imageUrls: prepared.imageUrls,
      pollOptions: [],
    });
    // Whoever wrote it is never part of the answer.
    expect(JSON.stringify(result)).not.toContain("u1");
  });

  it("is not on the Free plan, and a lapsed plan counts as Free", async () => {
    for (const ownership of [
      { claimStatus: "APPROVED", tier: "FREE", planStatus: "ACTIVE" },
      { claimStatus: "APPROVED", tier: "PRO", planStatus: "PAST_DUE" },
    ]) {
      const { service, social } = setup({ ownership });
      await expect(service.schedule("u1", { companyId: CID, caption: "x", publishAt: inDays(1) }, [])).rejects.toBeInstanceOf(ForbiddenException);
      // Refused before any photo is processed.
      expect(social.prepareNewPost).not.toHaveBeenCalled();
    }
  });

  it("is only for an approved owner", async () => {
    const { service } = setup({ ownership: null });
    await expect(service.schedule("u1", { companyId: CID, caption: "x", publishAt: inDays(1) }, [])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("holds as many waiting posts as the plan says", async () => {
    const full = setup({ waiting: 3 });
    await expect(full.service.schedule("u1", { companyId: CID, caption: "x", publishAt: inDays(1) }, [])).rejects.toThrow(/up to 3 posts waiting/);
    expect(full.social.prepareNewPost).not.toHaveBeenCalled();

    const pro = setup({ waiting: 3, ownership: { claimStatus: "APPROVED", tier: "PRO", planStatus: "ACTIVE" } });
    await expect(pro.service.schedule("u1", { companyId: CID, caption: "x", publishAt: inDays(1) }, [])).resolves.toBeDefined();
  });

  it("wants a time between 5 minutes and 60 days from now", async () => {
    const { service } = setup();
    await expect(service.schedule("u1", { companyId: CID, caption: "x", publishAt: inMinutes(2) }, [])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.schedule("u1", { companyId: CID, caption: "x", publishAt: inMinutes(-30) }, [])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.schedule("u1", { companyId: CID, caption: "x", publishAt: inDays(61) }, [])).rejects.toThrow(/60 days/);
  });
});

describe("SocialScheduleService.list", () => {
  it("gives the waiting posts and what the plan allows", async () => {
    const { service, prisma } = setup({ due: [row(), row({ id: "s2", status: "FAILED", failureReason: "The job posting is no longer open." })] });
    const result = await service.list("u1", CID);
    expect(result).toMatchObject({ tier: "STARTER", limit: 3, waiting: 1 });
    expect(result.posts.map((p) => [p.id, p.status, p.failureReason])).toEqual([
      ["s1", "SCHEDULED", null],
      ["s2", "FAILED", "The job posting is no longer open."],
    ]);
    expect(prisma.scheduledSocialPost.findMany.mock.calls[0][0].where).toEqual({ companyId: CID });
  });

  it("is refused to anyone but an approved owner of that company", async () => {
    const { service, prisma } = setup({ ownership: { claimStatus: "REJECTED", tier: "PRO", planStatus: "ACTIVE" } });
    await expect(service.list("u1", CID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.scheduledSocialPost.findMany).not.toHaveBeenCalled();
  });
});

describe("SocialScheduleService publishing", () => {
  it("creates the post and removes the waiting row in one transaction", async () => {
    const { service, prisma, social, tx } = setup({ due: [row()] });
    expect(await service.publishDue()).toBe(1);

    expect(prisma.scheduledSocialPost.findMany.mock.calls[0][0].where).toMatchObject({ status: "SCHEDULED" });
    expect(tx.scheduledSocialPost.deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(social.publishPrepared).toHaveBeenCalledWith(expect.objectContaining({ companyId: CID, kind: "UPDATE", imageUrls: prepared.imageUrls }), "u1", tx);
  });

  it("does not publish a row another request has already taken", async () => {
    const { service, social } = setup({ due: [row()], claimed: 0 });
    await service.publishDue();
    expect(social.publishPrepared).not.toHaveBeenCalled();
  });

  it("marks a post that can no longer go out, with the reason, instead of publishing it", async () => {
    const cases: [Parameters<typeof setup>[0], Record<string, unknown>, RegExp][] = [
      [{ owners: 0 }, {}, /no longer has an approved owner/],
      [{ liveJob: false }, { payload: { ...row().payload, kind: "HIRING", jobPostingId: "j1" } }, /no longer open/],
      [{}, { payload: { ...row().payload, kind: "EVENT", title: "Open day", eventStartsAt: inMinutes(-5) } }, /already passed/],
    ];
    for (const [over, rowOver, reason] of cases) {
      const { service, prisma, social } = setup({ ...over, due: [row(rowOver)] });
      await service.publishDue();
      expect(social.publishPrepared).not.toHaveBeenCalled();
      const update = prisma.scheduledSocialPost.updateMany.mock.calls[0][0];
      expect(update.data.status).toBe("FAILED");
      expect(update.data.failureReason).toMatch(reason);
    }
  });

  it("carries on with the rest when one post throws", async () => {
    const { service, social } = setup({ due: [row(), row({ id: "s2" })] });
    social.publishPrepared.mockRejectedValueOnce(new Error("db down"));
    await expect(service.publishDue()).resolves.toBe(2);
    expect(social.publishPrepared).toHaveBeenCalledTimes(2);
  });

  it("Post now publishes at once, and says why when it cannot", async () => {
    const ok = setup();
    await expect(ok.service.publishNow("u1", "s1")).resolves.toEqual({ id: "post-1" });

    const gone = setup({ claimed: 0 });
    await expect(gone.service.publishNow("u1", "s1")).rejects.toBeInstanceOf(NotFoundException);

    const closed = setup({ liveJob: false, found: row({ payload: { ...row().payload, kind: "HIRING", jobPostingId: "j1" } }) });
    await expect(closed.service.publishNow("u1", "s1")).rejects.toThrow(/no longer open/);

    const stranger = setup({ ownership: null });
    await expect(stranger.service.publishNow("u2", "s1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(stranger.social.publishPrepared).not.toHaveBeenCalled();
  });
});

describe("SocialScheduleService.reschedule and remove", () => {
  it("moves the time and puts a failed post back in line", async () => {
    const { service, prisma } = setup({ found: row({ status: "FAILED", failureReason: "The job posting is no longer open." }) });
    const publishAt = inDays(3);
    const result = await service.reschedule("u1", "s1", publishAt);
    expect(prisma.scheduledSocialPost.update.mock.calls[0][0].data).toEqual({ publishAt: new Date(publishAt), status: "SCHEDULED", failureReason: null });
    expect(result.status).toBe("SCHEDULED");
  });

  it("will not move a post past the event it announces", async () => {
    const { service } = setup({ found: row({ payload: { ...row().payload, kind: "EVENT", title: "Open day", eventStartsAt: inDays(2) } }) });
    await expect(service.reschedule("u1", "s1", inDays(3))).rejects.toThrow(/has to start after/);
  });

  it("a failed post only goes back in line while the plan has room", async () => {
    const { service } = setup({ waiting: 3, found: row({ status: "FAILED" }) });
    await expect(service.reschedule("u1", "s1", inDays(1))).rejects.toThrow(/up to 3 posts waiting/);
  });

  it("deleting removes the row and its photo files", async () => {
    const { service, prisma, social } = setup();
    await expect(service.remove("u1", "s1")).resolves.toEqual({ success: true });
    expect(prisma.scheduledSocialPost.deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(social.unlinkImages).toHaveBeenCalledWith(["http://x/uploads/social/a.webp"]);
  });

  it("leaves the photos alone when the post went out in the same instant", async () => {
    const { service, prisma, social } = setup();
    prisma.scheduledSocialPost.deleteMany.mockResolvedValue({ count: 0 });
    await service.remove("u1", "s1");
    expect(social.unlinkImages).not.toHaveBeenCalled();
  });

  it("404s on an unknown id and 403s for someone else's company", async () => {
    await expect(setup({ found: null }).service.remove("u1", "nope")).rejects.toBeInstanceOf(NotFoundException);
    const stranger = setup({ ownership: null });
    await expect(stranger.service.remove("u2", "s1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(stranger.prisma.scheduledSocialPost.deleteMany).not.toHaveBeenCalled();
  });
});

describe("SocialScheduleWorker", () => {
  it("runs one pass at a time", async () => {
    let release: () => void = () => undefined;
    const publishDue = jest.fn().mockImplementation(() => new Promise<number>((resolve) => (release = () => resolve(0))));
    const worker = new SocialScheduleWorker({ publishDue } as never);
    const first = worker.tick();
    await worker.tick();
    expect(publishDue).toHaveBeenCalledTimes(1);
    release();
    await first;
    const next = worker.tick();
    expect(publishDue).toHaveBeenCalledTimes(2);
    release();
    await next;
  });

  it("does not poll when switched off", () => {
    const spy = jest.spyOn(global, "setInterval");
    process.env.SOCIAL_SCHEDULE_WORKER_DISABLED = "1";
    new SocialScheduleWorker({ publishDue: jest.fn() } as never).onModuleInit();
    expect(spy).not.toHaveBeenCalled();
    delete process.env.SOCIAL_SCHEDULE_WORKER_DISABLED;
    spy.mockRestore();
  });
});
