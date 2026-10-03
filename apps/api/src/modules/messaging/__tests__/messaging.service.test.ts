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

type Owner = { userId: string; companyId: string; claimStatus: string; createdAt?: Date; showNameInMessages?: boolean };

function setup(opts: { reviews?: FakeReview[]; owners?: Owner[]; ownerNames?: Record<string, string> } = {}) {
  const prisma = createFakePrisma({
    reviews: opts.reviews ?? [review()],
    users: [
      { id: REVIEWER, reviewUsername: "Quiet Beaver", avatarKey: "office_owl", avatarGradient: "sunset" },
      { id: OWNER, reviewUsername: "Owner Handle" },
    ],
    companies: [
      { id: COMPANY, name: "Demo Finans Holding", slug: "demo-finans-holding", mainPhotoUrl: "/uploads/logo.webp" },
      { id: "company-2", name: "Demo Lojistik", slug: "demo-lojistik" },
    ],
    owners: opts.owners ?? [{ userId: OWNER, companyId: COMPANY, claimStatus: "APPROVED", showNameInMessages: true }],
  });
  const names = opts.ownerNames ?? { [OWNER]: "Ahmet Yılmaz" };
  const employerProfile = { getRepresentativeName: async (userId: string) => names[userId] ?? null };
  return { prisma, service: new MessagingService(prisma, new ModerationService(), employerProfile as any) };
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
      service.startConversation(REVIEWER, "review-1", { content: "You are all s t u p i d" }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma._state.conversations).toHaveLength(0);
  });

  it("lets a phone number through and marks that message for the warning note", async () => {
    const { service } = setup();
    const thread = await service.startConversation(REVIEWER, "review-1", {
      content: "If you agree, my number is 0532 123 45 67",
    });
    expect(thread.messages.map((m) => m.sharesPhoneNumber)).toEqual([true]);
  });

  it("does not mark an ordinary message", async () => {
    const { service } = setup();
    const thread = await service.startConversation(REVIEWER, "review-1", hello);
    expect(thread.messages.map((m) => m.sharesPhoneNumber)).toEqual([false]);
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

  it("gives an owner one inbox across every company they own, and nothing for anyone else", async () => {
    const reviews = [review(), review({ id: "review-2", companyId: "company-2" })];
    const owners = [
      { userId: OWNER, companyId: COMPANY, claimStatus: "APPROVED" },
      { userId: OWNER, companyId: "company-2", claimStatus: "APPROVED" },
    ];
    const { service } = setup({ reviews, owners });
    await service.startConversation(REVIEWER, "review-1", hello);
    await service.startConversation(REVIEWER, "review-2", hello);
    const list = await service.listForOwner(OWNER);
    expect(list.map((c) => c.companyName).sort()).toEqual(["Demo Finans Holding", "Demo Lojistik"]);
    expect(await service.listForOwner(OUTSIDER)).toEqual([]);
    expect(await service.listForOwner(REVIEWER)).toEqual([]);
  });
});

describe("MessagingService conversation identity", () => {
  it("shows both sides the company logo and the review's public name and avatar", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    const companyView = await service.getThread(OWNER, started.id);
    for (const view of [started, companyView]) {
      expect(view).toEqual(
        expect.objectContaining({
          companyName: "Demo Finans Holding",
          companyLogoUrl: "/uploads/logo.webp",
          reviewerName: "Quiet Beaver",
          reviewerAvatarKey: "office_owl",
          reviewerAvatarGradient: "sunset",
        }),
      );
    }
  });

  it("hides the account's own avatar behind the generic one on a randomized review", async () => {
    const { service } = setup({ reviews: [review({ isRandomizedIdentity: true, displayUsername: "Sleepy Otter" })] });
    await service.startConversation(REVIEWER, "review-1", hello);
    const [row] = await service.listForCompany(OWNER, COMPANY);
    expect(row).toEqual(expect.objectContaining({ reviewerName: "Sleepy Otter", reviewerAvatarKey: "randomized_identity" }));
    expect(JSON.stringify(row)).not.toContain("office_owl");
  });

  it("shows the reviewer no owner name until the company has replied", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    expect(started.ownerName).toBeNull();
    await service.sendMessage(OWNER, started.id, { content: "Thanks for writing, happy to talk." });
    expect((await service.getThread(REVIEWER, started.id)).ownerName).toBe("Ahmet Yılmaz");
  });

  it("never names the owner to the company side", async () => {
    const { service } = setup();
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await service.sendMessage(OWNER, started.id, { content: "Thanks for writing, happy to talk." });
    expect((await service.getThread(OWNER, started.id)).ownerName).toBeNull();
  });

  it("names the owner who wrote the company's latest message", async () => {
    const SECOND = "user-owner-2";
    const owners: Owner[] = [
      { userId: OWNER, companyId: COMPANY, claimStatus: "APPROVED", createdAt: new Date("2026-01-01") },
      { userId: SECOND, companyId: COMPANY, claimStatus: "APPROVED", createdAt: new Date("2026-02-01") },
    ];
    const { service } = setup({ owners, ownerNames: { [OWNER]: "Ahmet Yılmaz", [SECOND]: "Elif Kaya" } });
    const started = await service.startConversation(REVIEWER, "review-1", hello);
    await service.sendMessage(SECOND, started.id, { content: "Thanks, happy to hear more about the shifts." });
    expect((await service.getThread(REVIEWER, started.id)).ownerName).toBe("Elif Kaya");
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
      .startConversation(REVIEWER, "review-1", { content: "you idiot" })
      .catch((e: BadRequestException) => e);
    const body = (err as BadRequestException).getResponse() as { message: string; violationTypes: string[] };
    expect(body.message).toContain("offensive words");
    expect(body.message).not.toContain("PROFANITY");
    expect(body.violationTypes).toEqual(["PROFANITY"]);
  });
});
