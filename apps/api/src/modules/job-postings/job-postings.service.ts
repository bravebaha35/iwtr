import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminJobPosting,
  CreateJobPostingInput,
  CreateJobPostingResult,
  JobPosting as JobPostingView,
  JobPostingBoostStatus,
  JobPostingStatus,
  BoostOption,
  BoostPricingOption,
  UpdateJobPostingInput,
  UpdateJobPostingResult,
  WorkplaceType,
} from "@iwtr/shared-types";
import { BOOST_OPTION_DAYS } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { PaymentsService } from "../payments/payments.service";
import { decideBoostAccess, freeBoostsRemaining, tierKeyFromOwnerTier } from "./decideBoostAccess";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { shouldLazyReshare, isWithinSavedGraceWindow, daysRemaining } from "./job-postings.util";

// A job ad is the employer's own text, like its IWT Social caption: a job
// title such as "Kredi Analisti" reads as a first name + surname to the
// review rules, so the name and job-title checks are skipped here (same
// opt-out SocialService.createPost uses). Profanity, sexual content, abuse
// and phone numbers still apply.
const JOB_AD_SKIPPED_CHECKS = { skipViolationTypes: ["NAME_OR_SURNAME", "JOB_TITLE"] as ("NAME_OR_SURNAME" | "JOB_TITLE")[] };

// The site's own company row (see scripts/grant-iwtr-ownership.ts).
const PLATFORM_COMPANY_NAME = "I Worked There";

const BOOST_PRICING: BoostPricingOption[] = [
  { option: "FEATURED_7", durationDays: BOOST_OPTION_DAYS.FEATURED_7, priceTry: "299.99" },
  { option: "FEATURED_14", durationDays: BOOST_OPTION_DAYS.FEATURED_14, priceTry: "599.99" },
  { option: "AD_SPACE_14", durationDays: BOOST_OPTION_DAYS.AD_SPACE_14, priceTry: "999.99" },
];

function boostPrice(option: BoostOption): string {
  return BOOST_PRICING.find((p) => p.option === option)!.priceTry;
}

const BOOST_ITEM_NAME: Record<BoostOption, string> = {
  FEATURED_7: "Featured job ad: 7 days",
  FEATURED_14: "Featured job ad: 14 days",
  AD_SPACE_14: "Employer ad space: 14 days",
};

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
  boostAdSpace?: boolean;
  createdAt: Date;
}): JobPostingView {
  return {
    id: posting.id,
    companyId: posting.companyId,
    jobTitle: posting.jobTitle,
    description: posting.description,
    workType: posting.workType,
    status: posting.status,
    boostDurationDays: posting.boostDurationDays ?? null,
    boostExpiresAt: posting.boostExpiresAt ? posting.boostExpiresAt.toISOString() : null,
    boostAdSpace: posting.boostAdSpace ?? false,
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

  // Counted per company (not per owner account): the allowance belongs to
  // the company's plan, and a boost can be added to any of its postings.
  private async freeBoostsUsedThisMonth(companyId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return this.prisma.jobPosting.count({
      where: { companyId, boostIsFree: true, boostStartedAt: { gte: startOfMonth } },
    });
  }

  // A plain substring scan against every other company's name — the
  // moderation module itself has no DB dependency by design (pure text-in,
  // verdict-out, see its own class comment), so this competitor-name check
  // lives here rather than inside ModerationService.checkContent. Same
  // 5000-row safety ceiling companies.service.ts's search already accepts.
  // The platform's own listing (PLATFORM_COMPANY_NAME) is never a
  // competitor: "Apply with your CV through I Worked There" is a normal
  // thing for any job ad on this site to say.
  private async mentionsCompetitorName(companyId: string, text: string): Promise<boolean> {
    const others = await this.prisma.company.findMany({
      where: { id: { not: companyId }, NOT: { name: { equals: PLATFORM_COMPANY_NAME, mode: "insensitive" } } },
      select: { name: true },
      take: 5000,
    });
    const lower = text.toLowerCase();
    return others.some((c) => c.name.length >= 3 && lower.includes(c.name.toLowerCase()));
  }

  async getBoostStatus(userId: string, companyId: string): Promise<JobPostingBoostStatus> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);
    const tierKey = tierKeyFromOwnerTier(ownership.tier);
    const usedThisMonth = await this.freeBoostsUsedThisMonth(companyId);
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

    const contentCheck = this.moderation.checkContent([input.jobTitle, input.description], JOB_AD_SKIPPED_CHECKS);
    const hasCompetitorName = await this.mentionsCompetitorName(companyId, `${input.jobTitle} ${input.description}`);
    const status: JobPostingStatus = contentCheck.violates || hasCompetitorName ? "PENDING_ADMIN" : "PUBLISHED";

    // Decide free-vs-paid and check billing BEFORE the posting exists — a
    // missing-billing rejection after the create would leave a posting
    // behind, and the owner's natural "fix the form and resubmit" would then
    // create a duplicate.
    const boostIsFree = input.boost ? await this.checkBoostAffordable(companyId, ownership.tier, input.boost) : false;

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

    const createdStatus = status === "PENDING_ADMIN" ? "PENDING_ADMIN" : "PUBLISHED";

    if (!input.boost) {
      return { status: createdStatus, jobPosting: toPublic(posting) };
    }
    return this.startBoost(posting, input.boost, boostIsFree, createdStatus, "Your job posting was created");
  }

  /**
   * Decides whether a requested boost is covered by the company's free
   * monthly allowance, and refuses a paid one with no billing details -
   * before anything is written, so the owner can fix the form and resubmit.
   */
  private async checkBoostAffordable(
    companyId: string,
    tier: Parameters<typeof tierKeyFromOwnerTier>[0],
    boost: { option: BoostOption; billing?: unknown },
  ): Promise<boolean> {
    const { isFree } = decideBoostAccess({
      option: boost.option,
      tierKey: tierKeyFromOwnerTier(tier),
      freeBoostsUsedThisMonth: await this.freeBoostsUsedThisMonth(companyId),
    });
    if (!isFree && !boost.billing) {
      throw new BadRequestException("Billing details are required to pay for this boost.");
    }
    return isFree;
  }

  /**
   * Puts a boost on a saved posting: a free one goes live at once; a paid
   * one is marked PENDING and handed to iyzico's hosted checkout, and goes
   * live in completeCheckout. If the payment page can't be started the
   * PENDING marker is undone and the posting comes back unboosted with
   * boostError - the posting (and any description change) is already
   * saved, so throwing would make the owner redo work that already happened
   * (or create a duplicate posting).
   */
  private async startBoost(
    posting: Parameters<typeof toPublic>[0],
    boost: NonNullable<CreateJobPostingInput["boost"]>,
    isFree: boolean,
    savedStatus: "PUBLISHED" | "PENDING_ADMIN",
    savedWhat: string,
  ): Promise<CreateJobPostingResult> {
    const days = BOOST_OPTION_DAYS[boost.option];
    const adSpace = boost.option === "AD_SPACE_14";
    if (isFree) {
      const now = new Date();
      const updated = await this.prisma.jobPosting.update({
        where: { id: posting.id },
        data: {
          boostDurationDays: days,
          boostAdSpace: adSpace,
          boostIsFree: true,
          boostPaymentStatus: null,
          boostStartedAt: now,
          boostExpiresAt: addDays(now, days),
        },
      });
      return { status: savedStatus, jobPosting: toPublic(updated) };
    }

    // Checked up front already (checkBoostAffordable); re-narrowed here.
    if (!boost.billing) {
      throw new BadRequestException("Billing details are required to pay for this boost.");
    }

    await this.prisma.jobPosting.update({
      where: { id: posting.id },
      data: {
        boostDurationDays: days,
        boostAdSpace: adSpace,
        boostIsFree: false,
        boostPaymentStatus: "PENDING",
        boostStartedAt: null,
        boostExpiresAt: null,
      },
    });

    // Same "must be this API server's own public address, reachable by
    // iyzico's servers" constraint documented on PaymentsService's Plus
    // checkout — a tunnel is needed to exercise this locally end-to-end.
    const apiPublicUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/v1`;

    try {
      const checkout = await this.payments.createOneTimeCheckout({
        conversationId: posting.id,
        callbackUrl: `${apiPublicUrl.replace(/\/$/, "")}/job-postings/boost-checkout-callback`,
        priceTry: boostPrice(boost.option),
        basketId: posting.id,
        itemName: BOOST_ITEM_NAME[boost.option],
        buyerName: boost.billing.buyerName,
        buyerSurname: boost.billing.buyerSurname,
        buyerIdentityNumber: boost.billing.buyerIdentityNumber,
        buyerEmail: boost.billing.buyerEmail,
        buyerGsmNumber: boost.billing.buyerGsmNumber,
        billingAddress: boost.billing.billingAddress,
      });
      return {
        status: "CHECKOUT_REQUIRED",
        jobPosting: toPublic({ ...posting, boostDurationDays: days, boostAdSpace: adSpace, boostExpiresAt: null }),
        checkoutFormContent: checkout.checkoutFormContent,
        token: checkout.token,
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[job-postings] boost checkout could not start for posting=${posting.id}:`, err);
      await this.prisma.jobPosting.update({
        where: { id: posting.id },
        data: { boostDurationDays: null, boostAdSpace: false, boostPaymentStatus: null },
      });
      return {
        status: savedStatus,
        jobPosting: toPublic({ ...posting, boostDurationDays: null, boostAdSpace: false, boostExpiresAt: null }),
        boostError: `${savedWhat}, but the boost payment couldn't be started, so it isn't boosted. You weren't charged.`,
      };
    }
  }

  /**
   * The dashboard's Edit on an active posting: a new description and/or a
   * boost. The job title and work type never change here (they're what the
   * Risk Score matches on). A new description goes through the same checks
   * as a new posting - if flagged, the posting leaves the Jobs page until
   * an admin approves it. A boost can only be added while the posting isn't
   * already boosted.
   */
  async update(
    userId: string,
    companyId: string,
    jobPostingId: string,
    input: UpdateJobPostingInput,
  ): Promise<UpdateJobPostingResult> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);
    const existing = await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException("Job posting not found");
    }
    if (existing.status !== "PUBLISHED" || (daysRemaining(existing) === 0 && !shouldLazyReshare(existing))) {
      throw new BadRequestException("Only an active job posting can be edited.");
    }
    const boost = input.boost ?? null;
    if (boost && existing.boostExpiresAt && existing.boostExpiresAt > new Date()) {
      throw new BadRequestException("This job posting is already boosted.");
    }
    const boostIsFree = boost ? await this.checkBoostAffordable(companyId, ownership.tier, boost) : false;

    let posting = existing;
    let savedStatus: "PUBLISHED" | "PENDING_ADMIN" = "PUBLISHED";
    if (input.description !== undefined && input.description !== existing.description) {
      const contentCheck = this.moderation.checkContent([existing.jobTitle, input.description], JOB_AD_SKIPPED_CHECKS);
      const hasCompetitorName = await this.mentionsCompetitorName(companyId, `${existing.jobTitle} ${input.description}`);
      savedStatus = contentCheck.violates || hasCompetitorName ? "PENDING_ADMIN" : "PUBLISHED";
      posting = await this.prisma.jobPosting.update({
        where: { id: jobPostingId },
        data: { description: input.description, status: savedStatus },
      });
    }

    if (!boost) {
      return { status: savedStatus, jobPosting: toPublic(posting) };
    }
    // A posting waiting for review isn't on the Jobs page, so a boost would
    // burn days (or a free boost) unseen. Nothing is charged; boost it again
    // once it's approved.
    if (savedStatus === "PENDING_ADMIN") {
      return {
        status: savedStatus,
        jobPosting: toPublic(posting),
        boostError: "Your changes were saved, but they need a quick check first, so the boost wasn't started. You weren't charged - boost it again once it's approved.",
      };
    }
    return this.startBoost(posting, boost, boostIsFree, savedStatus, "Your changes were saved");
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
        boostStartedAt: new Date(),
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

