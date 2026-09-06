import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminJobPosting,
  CreateJobPostingInput,
  CreateJobPostingResult,
  JobPosting as JobPostingView,
  JobPostingBoostStatus,
  JobPostingStatus,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { PaymentsService } from "../payments/payments.service";
import { decideBoostAccess, freeBoostsRemaining, tierKeyFromOwnerTier } from "./decideBoostAccess";

const BOOST_PRICING: { durationDays: 7 | 14 | 21; priceTry: string }[] = [
  { durationDays: 7, priceTry: "299.99" },
  { durationDays: 14, priceTry: "599.99" },
  { durationDays: 21, priceTry: "999.99" },
];

function boostPrice(durationDays: 7 | 14 | 21): string {
  return BOOST_PRICING.find((p) => p.durationDays === durationDays)!.priceTry;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function toPublic(posting: {
  id: string;
  companyId: string;
  jobTitle: string;
  description: string;
  status: JobPostingStatus;
  boostDurationDays: number | null;
  boostExpiresAt: Date | null;
  createdAt: Date;
}): JobPostingView {
  return {
    id: posting.id,
    companyId: posting.companyId,
    jobTitle: posting.jobTitle,
    description: posting.description,
    status: posting.status,
    boostDurationDays: (posting.boostDurationDays as 7 | 14 | 21 | null) ?? null,
    boostExpiresAt: posting.boostExpiresAt ? posting.boostExpiresAt.toISOString() : null,
    createdAt: posting.createdAt.toISOString(),
  };
}

@Injectable()
export class JobPostingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly payments: PaymentsService,
  ) {}

  // Duplicated rather than cross-imported from owner.service.ts — matches
  // this codebase's existing module-per-feature convention (see the
  // identical comment on RivalAnalyticsService's own copy).
  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company");
    }
    return ownership;
  }

  private async freeBoostsUsedThisMonth(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return this.prisma.jobPosting.count({
      where: { createdByUserId: userId, boostIsFree: true, createdAt: { gte: startOfMonth } },
    });
  }

  // A plain substring scan against every other company's name — the
  // moderation module itself has no DB dependency by design (pure text-in,
  // verdict-out, see its own class comment), so this competitor-name check
  // lives here rather than inside ModerationService.checkContent. Same
  // 5000-row safety ceiling companies.service.ts's search already accepts.
  private async mentionsCompetitorName(companyId: string, text: string): Promise<boolean> {
    const others = await this.prisma.company.findMany({
      where: { id: { not: companyId } },
      select: { name: true },
      take: 5000,
    });
    const lower = text.toLowerCase();
    return others.some((c) => c.name.length >= 3 && lower.includes(c.name.toLowerCase()));
  }

  async getBoostStatus(userId: string, companyId: string): Promise<JobPostingBoostStatus> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);
    const tierKey = tierKeyFromOwnerTier(ownership.tier);
    const usedThisMonth = await this.freeBoostsUsedThisMonth(userId);
    return {
      tierKey,
      freeBoostsRemaining: freeBoostsRemaining(tierKey, usedThisMonth),
      pricing: BOOST_PRICING,
    };
  }

  /**
   * Always creates the posting — a flagged posting still gets a row (status
   * PENDING_ADMIN), it just isn't publicly visible until an admin approves
   * it (see adminApprove below). Boost handling happens after the posting
   * exists, so a boost purchase always has a real jobPostingId to key off of
   * (same order RivalAnalyticsService.requestReport uses: create your own
   * row, then hand off to payments).
   */
  async create(userId: string, companyId: string, input: CreateJobPostingInput): Promise<CreateJobPostingResult> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);

    const contentCheck = this.moderation.checkContent([input.jobTitle, input.description]);
    const hasCompetitorName = await this.mentionsCompetitorName(companyId, `${input.jobTitle} ${input.description}`);
    const status: JobPostingStatus = contentCheck.violates || hasCompetitorName ? "PENDING_ADMIN" : "PUBLISHED";

    const posting = await this.prisma.jobPosting.create({
      data: { companyId, createdByUserId: userId, jobTitle: input.jobTitle, description: input.description, status },
    });

    if (!input.boost) {
      return { status: status === "PENDING_ADMIN" ? "PENDING_ADMIN" : "PUBLISHED", jobPosting: toPublic(posting) };
    }

    const tierKey = tierKeyFromOwnerTier(ownership.tier);
    const usedThisMonth = await this.freeBoostsUsedThisMonth(userId);
    const access = decideBoostAccess({
      durationDays: input.boost.durationDays,
      tierKey,
      freeBoostsUsedThisMonth: usedThisMonth,
    });

    if (access.isFree) {
      const updated = await this.prisma.jobPosting.update({
        where: { id: posting.id },
        data: {
          boostDurationDays: input.boost.durationDays,
          boostIsFree: true,
          boostExpiresAt: addDays(new Date(), input.boost.durationDays),
        },
      });
      return { status: status === "PENDING_ADMIN" ? "PENDING_ADMIN" : "PUBLISHED", jobPosting: toPublic(updated) };
    }

    if (!input.boost.billing) {
      throw new BadRequestException("Billing details are required to pay for this boost.");
    }

    await this.prisma.jobPosting.update({
      where: { id: posting.id },
      data: { boostDurationDays: input.boost.durationDays, boostPaymentStatus: "PENDING" },
    });

    // Same "must be this API server's own public address, reachable by
    // iyzico's servers" constraint documented on PaymentsService's Plus
    // checkout — a tunnel is needed to exercise this locally end-to-end.
    const apiPublicUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/v1`;

    try {
      const checkout = await this.payments.createOneTimeCheckout({
        conversationId: posting.id,
        callbackUrl: `${apiPublicUrl.replace(/\/$/, "")}/job-postings/boost-checkout-callback`,
        priceTry: boostPrice(input.boost.durationDays),
        basketId: posting.id,
        itemName: `Job posting boost: ${input.boost.durationDays} days`,
        buyerName: input.boost.billing.buyerName,
        buyerSurname: input.boost.billing.buyerSurname,
        buyerIdentityNumber: input.boost.billing.buyerIdentityNumber,
        buyerEmail: input.boost.billing.buyerEmail,
        buyerGsmNumber: input.boost.billing.buyerGsmNumber,
        billingAddress: input.boost.billing.billingAddress,
      });
      return {
        status: "CHECKOUT_REQUIRED",
        jobPosting: toPublic({ ...posting, boostDurationDays: input.boost.durationDays }),
        checkoutFormContent: checkout.checkoutFormContent,
        token: checkout.token,
      };
    } catch {
      // iyzico not configured (no API keys yet) or a live-call failure —
      // same "not set up yet" condition Rival Analytics/Plus checkout
      // already surface as a friendly message instead of a raw 5xx. The
      // posting itself still exists (already published or pending review);
      // only the boost failed, so there's nothing to roll back here.
      throw new BadRequestException(
        "Payment isn't set up yet — the site owner needs to add iyzico payment credentials first.",
      );
    }
  }

  /**
   * Called from the public iyzico callback route once the browser lands back
   * from the hosted Checkout Form. Idempotent, same as
   * RivalAnalyticsService.completeCheckout: a no-op if the purchase wasn't
   * found, wasn't actually paid, or was already marked PAID.
   */
  async completeCheckout(token: string): Promise<void> {
    const status = await this.payments.retrieveOneTimeCheckoutStatus(token).catch(() => null);
    if (!status?.paid || !status.conversationId) return;

    const posting = await this.prisma.jobPosting.findUnique({ where: { id: status.conversationId } });
    if (!posting || posting.boostPaymentStatus !== "PENDING" || !posting.boostDurationDays) return;

    await this.prisma.jobPosting.update({
      where: { id: posting.id },
      data: {
        boostPaymentStatus: "PAID",
        boostExpiresAt: addDays(new Date(), posting.boostDurationDays),
      },
    });
  }

  async adminList(status: JobPostingStatus): Promise<AdminJobPosting[]> {
    const rows = await this.prisma.jobPosting.findMany({
      where: { status },
      include: { company: { select: { name: true } }, createdByUser: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      ...toPublic(row),
      companyName: row.company.name,
      createdByUserEmail: row.createdByUser.email,
    }));
  }

  async adminApprove(id: string): Promise<JobPostingView> {
    const updated = await this.updateStatusOrThrow(id, "PUBLISHED");
    return toPublic(updated);
  }

  async adminReject(id: string): Promise<JobPostingView> {
    const updated = await this.updateStatusOrThrow(id, "REJECTED");
    return toPublic(updated);
  }

  private async updateStatusOrThrow(id: string, status: JobPostingStatus) {
    const existing = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Job posting not found");
    }
    return this.prisma.jobPosting.update({ where: { id }, data: { status } });
  }
}
