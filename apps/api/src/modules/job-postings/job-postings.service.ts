import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminJobPosting,
  CreateJobPostingInput,
  CreateJobPostingResult,
  JobPosting as JobPostingView,
  JobPostingBoostStatus,
  JobPostingStatus,
  WorkplaceType,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { PaymentsService } from "../payments/payments.service";
import { decideBoostAccess, freeBoostsRemaining, tierKeyFromOwnerTier } from "./decideBoostAccess";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { shouldLazyReshare, isWithinSavedGraceWindow, daysRemaining } from "./job-postings.util";

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
  workType: WorkplaceType | null;
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
    workType: posting.workType,
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

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workplaceTypes: true },
    });
    if (!company) {
      throw new BadRequestException("workType must be one of this company's own work types.");
    }
    const workplaceTypes = company.workplaceTypes as WorkplaceType[];
    const workType = input.workType;
    if (!workplaceTypes.includes(workType)) {
      throw new BadRequestException("workType must be one of this company's own work types.");
    }

    const contentCheck = this.moderation.checkContent([input.jobTitle, input.description]);
    const hasCompetitorName = await this.mentionsCompetitorName(companyId, `${input.jobTitle} ${input.description}`);
    const status: JobPostingStatus = contentCheck.violates || hasCompetitorName ? "PENDING_ADMIN" : "PUBLISHED";

    // Risk Score: does this exact title+workType match an earlier posting of
    // this company's that was marked FILLED (i.e. they claimed a hire, then
    // reopened the identical role)? A plain repost of a still-open or
    // naturally-expired-but-never-filled posting does NOT count — see
    // job-lifecycle-risk-score-backend.md's brainstorming section. Only a
    // posting that actually goes live (PUBLISHED) can trigger the increment
    // — one flagged for moderation must not leave a permanent mark. The
    // create + conditional increment + audit entry run in one transaction so
    // a crash between them can't leave a bumped score with no posting behind
    // it, or vice versa. The increment itself is an atomic, capped
    // updateMany (not a read-modify-write) so two concurrent creates can't
    // lose an increment racing each other.
    const posting = await this.prisma.$transaction(async (tx) => {
      const created = await tx.jobPosting.create({
        data: {
          companyId,
          createdByUserId: userId,
          jobTitle: input.jobTitle,
          description: input.description,
          workType,
          autoReshareEnabled: input.autoReshareEnabled,
          status,
        },
      });

      if (status === "PUBLISHED") {
        const priorFilledMatch = await tx.jobPosting.findFirst({
          where: {
            companyId,
            workType,
            status: "FILLED",
            jobTitle: { equals: input.jobTitle, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (priorFilledMatch) {
          await tx.company.updateMany({
            where: { id: companyId, riskScore: { lt: 3 } },
            data: { riskScore: { increment: 1 } },
          });
          await tx.auditLog.create({
            data: {
              actorUserId: userId,
              action: "RISK_SCORE_INCREMENT",
              targetType: "Company",
              targetId: companyId,
              metadata: {
                jobPostingId: created.id,
                matchedPriorPostingId: priorFilledMatch.id,
                jobTitle: input.jobTitle,
                workType,
              },
            },
          });
        }
      }

      return created;
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
   * The soft-delete: the only manual way a posting stops being publicly
   * live. Never deletes the row — Risk Score's create-time check depends on
   * FILLED rows persisting forever (see mentionsCompetitorName-adjacent
   * comment above for the same "never trust the client, always re-verify
   * ownership" pattern).
   */
  async markFilled(userId: string, companyId: string, jobPostingId: string): Promise<JobPostingView> {
    await this.requireApprovedOwnership(userId, companyId);
    const posting = await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!posting || posting.companyId !== companyId) {
      throw new NotFoundException("Job posting not found");
    }
    if (posting.status !== "PUBLISHED") {
      throw new BadRequestException("Only a published posting can be marked filled.");
    }
    const updated = await this.prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: { status: "FILLED", filledAt: new Date() },
    });
    return toPublic(updated);
  }

  /**
   * The owner's own view of every posting they've ever made for this
   * company — every status, including ones that have left the public feed,
   * for up to 30 more days (isWithinSavedGraceWindow) so they can still see
   * their recent history. A stale-but-resharing posting is refreshed right
   * here (shouldLazyReshare) rather than dropped — the entire "no cron"
   * mechanism this plan relies on.
   */
  async listOwnerPostings(userId: string, companyId: string): Promise<OwnerJobPosting[]> {
    await this.requireApprovedOwnership(userId, companyId);
    const rows = await this.prisma.jobPosting.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    // Batched lazy-reshare, same pattern as CompaniesService.jobPostingsByCompanyId
    // — evaluate each row against what it will look like immediately after a
    // reshare, without an await per row; the actual write is one updateMany
    // after this loop.
    const now = new Date();
    const staleIds: string[] = [];
    const result: OwnerJobPosting[] = [];
    for (const row of rows) {
      const reshareEligible = shouldLazyReshare(row);
      const current = reshareEligible ? { ...row, lastResharedAt: now } : row;
      if (reshareEligible) staleIds.push(row.id);
      if (!isWithinSavedGraceWindow(current)) continue;
      result.push({ ...toPublic(current), daysRemaining: daysRemaining(current) });
    }
    if (staleIds.length > 0) {
      await this.prisma.jobPosting.updateMany({ where: { id: { in: staleIds } }, data: { lastResharedAt: now } });
    }
    return result;
  }

  /**
   * Called from the public iyzico callback route once the browser lands back
   * from the hosted Checkout Form. Idempotent, same as
   * RivalAnalyticsService.completeCheckout: a no-op if the purchase wasn't
   * found, wasn't actually paid, or was already marked PAID.
   */
  async completeCheckout(token: string): Promise<void> {
    const status = await this.payments.retrieveOneTimeCheckoutStatus(token).catch((err) => {
      // A transient iyzico API error is otherwise indistinguishable from
      // "genuinely not paid" — log it so it's visible in server logs.
      // eslint-disable-next-line no-console
      console.error(`[job-postings] retrieveOneTimeCheckoutStatus failed for token=${token}:`, err);
      return null;
    });
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
      // Safety ceiling, same pattern as CompaniesService.search's own `take`
      // — this table has no other bound and the admin queue only ever needs
      // to work through the oldest backlog first.
      take: 5000,
    });
    return rows.map((row) => ({
      ...toPublic(row),
      companyName: row.company.name,
      // createdByUser is null once the creating owner has deleted their own
      // account (onDelete: SetNull) — the posting itself still belongs to
      // the company and stays listed.
      createdByUserEmail: row.createdByUser?.email ?? null,
    }));
  }

  async adminApprove(id: string): Promise<JobPostingView> {
    // Reset the 30-day live-window anchor to the moment of approval, not
    // creation — otherwise time spent waiting in the manual admin queue is
    // silently deducted from the posting's public days.
    const updated = await this.updateStatusOrThrow(id, "PUBLISHED", { lastResharedAt: new Date() });
    return toPublic(updated);
  }

  async adminReject(id: string): Promise<JobPostingView> {
    const updated = await this.updateStatusOrThrow(id, "REJECTED");
    return toPublic(updated);
  }

  private async updateStatusOrThrow(
    id: string,
    status: JobPostingStatus,
    extraData: { lastResharedAt?: Date } = {},
  ) {
    const existing = await this.prisma.jobPosting.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Job posting not found");
    }
    return this.prisma.jobPosting.update({ where: { id }, data: { status, ...extraData } });
  }
}

