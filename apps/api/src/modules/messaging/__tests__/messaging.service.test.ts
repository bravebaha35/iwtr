import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { MessagingService } from "../messaging.service";
import { ModerationService } from "../../moderation/moderation.service";
import { createFakePrisma, type FakeReview } from "./fake-prisma";

const REVIEWER = "user-reviewer";
const OWNER = "user-owner";
const OUTSIDER = "user-outsider";
const COMPANY = "company-1";

function review(overrides: Partial<FakeReview> = {}): FakeReview {
  return {
    id: "review-1",
    userId: REVIEWER,
    companyId: COMPANY,
    status: "PUBLISHED",
    isRandomizedIdentity: false,
    displayUsername: null,
    generalThoughts: "Managers were fair but the shifts were long.",
    hasReply: true,
    ...overrides,
  };
}

function setup(opts: { reviews?: FakeReview[]; owners?: { userId: string; companyId: string; claimStatus: string }[] } = {}) {
  const prisma = createFakePrisma({
    reviews: opts.reviews ?? [review()],
    users: [
      { id: REVIEWER, reviewUsername: "Quiet Beaver" },
      { id: OWNER, reviewUsername: "Owner Handle" },
    ],
    companies: [{ id: COMPANY, name: "Demo Finans Holding", slug: "demo-finans-holding" }],
    owners: opts.owners ?? [{ userId: OWNER, companyId: COMPANY, claimStatus: "APPROVED" }],
  });
  return { prisma, service: new MessagingService(prisma, new ModerationService()) };
}

const hello = { content: "Thanks for replying, can I explain the shift issue in more detail?" };

describe("MessagingService.startConversation", () => {
  it("lets the review's author open a conversation with a first message", async () => {
    const { service } = setup();
    const thread = await service.startConversation(REVIEWER, "review-1", hello);
    expect(thread.messages).toEqual([expect.objectContaining({ fromMe: true, content: hello.content, day: "2026-09-25" })]);
    expect(thread.counterpartName).toBe("Demo Finans Holding");
    expect(thread.unread).toBe(false);
  });

  it("is not found for someone who didn't write the review", async () => {
    const { service } = setup();
    await expect(service.startConversation(OUTSIDER, "review-1", hello)).rejects.toThrow(NotFoundException);
  });

  it("is not found for a review that isn't published", async () => {
    const { service } = setup({ reviews: [review({ status: "PENDING_ADMIN_REVIEW" })] });
    await expect(service.startConversation(REVIEWER, "review-1", hello)).rejects.toThrow(NotFoundException);
  });

  it("is not found when the company hasn't replied to the review", async () => {
    const { service } = setup({ reviews: [review({ hasReply: false })] });
    await expect(service.startConversation(REVIEWER, "review-1", hello)).rejects.toThrow(NotFoundException);
  });

  it("refuses a second conversation for the same review with a conflict, not a crash", async () => {
    const { service } = setup();
    await service.startConversation(REVIEWER, "review-1", hello);
    await expect(service.startConversation(REVIEWER, "review-1", hello)).rejects.toThrow(ConflictException);
  });

  it("blocks an opening message that fails the content check and saves nothing", async () => {
    const { service, prisma } = setup();
    await expect(
      service.startConversation(REVIEWER, "review-1", { content: "Please call me on 0532 123 45 67" }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma._state.conversations).toHaveLength(0);
  });
});

describe("MessagingService for a reviewer who has become a company owner", () => {
  // Someone who wrote a review and later claimed their own company only
  // gets messages through the company dashboard — no personal inbox.
  const OTHER_COMPANY = "company-2";
  const reviewerNowOwner = [
    { userId: OWNER, companyId: COMPANY, claimStatus: "APPROVED" },
    { userId: REVIEWER, companyId: OTHER_COMPANY, claimStatus: "APPROVED" },
  ];

  it("can't open a conversation from their old review", async () => {
    const { service } = setup({ owners: reviewerNowOwner });
    await expect(service.startConversation(REVIEWER, "review-1", hello)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("has an empty personal inbox, even with an older conversation", async () => {
    const owners = [{ userId: OWNER, companyId: COMPANY, claimStatus: "APPROVED" }];
    const { service } = setup({ owners });
    await service.startConversation(REVIEWER, "review-1", hello);
    expect(await service.listMine(REVIEWER)).toHaveLength(1);
    owners.push({ userId: REVIEWER, companyId: OTHER_COMPANY, claimStatus: "APPROVED" });
    expect(await service.listMine(REVIEWER)).toEqual([]);
  });

  it("a pending (not approved) claim changes nothing", async () => {
    const { service } = setup({
      owners: [
        { userId: OWNER, companyId: COMPANY, claimStatus: "APPROVED" },
        { userId: REVIEWER, companyId: OTHER_COMPANY, claimStatus: "PENDING" },
      ],
    });
    await expect(service.startConversation(REVIEWER, "review-1", hello)).resolves.toBeTruthy();
  });
});

describe("MessagingService.getThread", () => {
  it("shows the company only the review's public name and never the reviewer's user id", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    const thread = await service.getThread(OWNER, started.id);
    expect(thread.counterpartName).toBe("Quiet Beaver");
    expect(thread.companySlug).toBeNull();
    expect(thread.messages[0].fromMe).toBe(false);
    expect(JSON.stringify(thread)).not.toContain(REVIEWER);
  });

  it("shows the company the one-off name of a randomized-identity review", async () => {
    const { service } = setup({ reviews: [review({ isRandomizedIdentity: true, displayUsername: "Sleepy Otter" })] });
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    const thread = await service.getThread(OWNER, started.id);
    expect(thread.counterpartName).toBe("Sleepy Otter");
    expect(JSON.stringify(thread)).not.toContain("Quiet Beaver");
  });

  it("is not found for an outsider", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await expect(service.getThread(OUTSIDER, started.id)).rejects.toThrow(NotFoundException);
  });

  it("is not found for an owner whose claim is no longer approved", async () => {
    const { service } = setup({ owners: [{ userId: OWNER, companyId: COMPANY, claimStatus: "REJECTED" }] });
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await expect(service.getThread(OWNER, started.id)).rejects.toThrow(NotFoundException);
  });

  it("treats a reviewer who later also owns the company as the reviewer", async () => {
    // Opened while still only a reviewer; owners can't open new ones.
    const owners: { userId: string; companyId: string; claimStatus: string }[] = [];
    const { service } = setup({ owners });
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    owners.push({ userId: REVIEWER, companyId: COMPANY, claimStatus: "APPROVED" });
    const thread = await service.getThread(REVIEWER, started.id);
    expect(thread.messages[0].fromMe).toBe(true);
    expect(thread.counterpartName).toBe("Demo Finans Holding");
  });

  it("tells the reviewer they must wait for the company before writing again", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    expect(started.canSend).toBe(false);
    expect(started.cannotSendReason).toBe("AWAITING_COMPANY");
    const companyView = await service.getThread(OWNER, started.id);
    expect(companyView.canSend).toBe(true);
    expect(companyView.unread).toBe(true);
  });
});

describe("MessagingService inbox lists", () => {
  it("lists the reviewer's own conversations", async () => {
    const { service } = setup();
    await service.startConversation(REVIEWER, "review-1", hello);
    const list = await service.listMine(REVIEWER);
    expect(list).toEqual([
      expect.objectContaining({ counterpartName: "Demo Finans Holding", companySlug: "demo-finans-holding", unread: false }),
    ]);
    expect(await service.listMine(OUTSIDER)).toEqual([]);
  });

  it("lists a company's conversations for an approved owner, marked unread", async () => {
    const { service } = setup();
    await service.startConversation(REVIEWER, "review-1", hello);
    const list = await service.listForCompany(OWNER, COMPANY);
    expect(list).toEqual([expect.objectContaining({ counterpartName: "Quiet Beaver", unread: true, lastMessagePreview: hello.content })]);
    expect(JSON.stringify(list)).not.toContain(REVIEWER);
  });

  it("forbids the company inbox to someone who isn't an approved owner", async () => {
    const { service } = setup();
    await expect(service.listForCompany(OUTSIDER, COMPANY)).rejects.toThrow(ForbiddenException);
  });
});

describe("MessagingService.sendMessage", () => {
  it("refuses the reviewer's second message until the company has answered", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await expect(service.sendMessage(REVIEWER, started.id, { content: "Hello again?" })).rejects.toThrow(ConflictException);
  });

  it("becomes a normal back-and-forth once the company answers", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    const afterCompany = await service.sendMessage(OWNER, started.id, { content: "Of course, we'd like to hear more." });
    expect(afterCompany.messages.map((m) => m.fromMe)).toEqual([false, true]);
    const afterReviewer = await service.sendMessage(REVIEWER, started.id, { content: "The rota changed every week." });
    expect(afterReviewer.messages.map((m) => m.content)).toEqual([
      hello.content,
      "Of course, we'd like to hear more.",
      "The rota changed every week.",
    ]);
    expect(afterReviewer.canSend).toBe(true);
  });

  it("blocks a message that fails the content check and saves nothing", async () => {
    const { service, prisma } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await expect(
      service.sendMessage(OWNER, started.id, { content: "Is this Ahmet Yılmaz from the night shift?" }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma._state.messages).toHaveLength(1);
  });

  it("is not found for an outsider", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await expect(service.sendMessage(OUTSIDER, started.id, { content: "hi" })).rejects.toThrow(NotFoundException);
  });

  it("refuses any message after the conversation has ended", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await service.endConversation(REVIEWER, started.id);
    await expect(service.sendMessage(OWNER, started.id, { content: "Wait, one more thing" })).rejects.toThrow(ConflictException);
  });
});

describe("MessagingService.endConversation", () => {
  it("ends it for both sides and says who ended it", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    const mine = await service.endConversation(OWNER, started.id);
    expect(mine).toEqual(expect.objectContaining({ ended: true, endedBy: "YOU", canSend: false, cannotSendReason: "ENDED" }));
    const theirs = await service.getThread(REVIEWER, started.id);
    expect(theirs).toEqual(expect.objectContaining({ ended: true, endedBy: "THEM", cannotSendReason: "ENDED" }));
  });

  it("keeps the first ender when ended twice", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await service.endConversation(REVIEWER, started.id);
    const again = await service.endConversation(OWNER, started.id);
    expect(again.endedBy).toBe("THEM");
  });

  it("can't be restarted with a new conversation on the same review", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await service.endConversation(REVIEWER, started.id);
    await expect(service.startConversation(REVIEWER, "review-1", hello)).rejects.toThrow(ConflictException);
  });
});

describe("MessagingService.markRead", () => {
  it("clears the unread flag for the side that read it", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    expect((await service.listForCompany(OWNER, COMPANY))[0].unread).toBe(true);
    await service.markRead(OWNER, started.id);
    expect((await service.listForCompany(OWNER, COMPANY))[0].unread).toBe(false);
  });

  it("works on an ended conversation", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await service.endConversation(REVIEWER, started.id);
    await expect(service.markRead(OWNER, started.id)).resolves.toBeUndefined();
  });

  it("is not found for an outsider", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await expect(service.markRead(OUTSIDER, started.id)).rejects.toThrow(NotFoundException);
  });
});

describe("MessagingService blocked-message wording", () => {
  it("explains a blocked message in plain words, not internal codes", async () => {
    const { service } = setup();
    const err = await service
      .startConversation(REVIEWER, "review-1", { content: "Please call me on 0532 123 45 67" })
      .catch((e: BadRequestException) => e);
    const body = (err as BadRequestException).getResponse() as { message: string; violationTypes: string[] };
    expect(body.message).toContain("a phone number");
    expect(body.message).not.toContain("PII_PHONE_NUMBER");
    expect(body.violationTypes).toEqual(["PII_PHONE_NUMBER"]);
  });
});
