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

  it("treats a reviewer who also owns the company as the reviewer", async () => {
    const { service } = setup({ owners: [{ userId: REVIEWER, companyId: COMPANY, claimStatus: "APPROVED" }] });
    const started = await service.startConversation(REVIEWER, "review-1", hello);
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
