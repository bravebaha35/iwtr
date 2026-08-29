import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Company } from "@prisma/client";
import type { RivalAnalyticsRequestInput, RivalAnalyticsRequestResult, RivalAnalyticsTier, WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FlagCalculatorService } from "../flags/flag-calculator.service";
import { getQuestionsFor } from "../reviews/survey-questions.data";
import { tallyQuestions } from "../reviews/survey-tally.util";
import { PaymentsService } from "../payments/payments.service";
import { decideRivalAnalyticsAccess } from "./access-decision.util";
import { mostAgreedAndDisputed } from "./highlights.util";
import { summarizeCommentThemes, type ThemeMention } from "./comment-theme-summary.util";
import { buildRivalAnalyticsPdf } from "./pdf-report.builder";
import { EMAIL_PROVIDER, type IEmailProvider } from "./email/email-provider.interface";

@Injectable()
export class RivalAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flagCalculator: FlagCalculatorService,
    private readonly payments: PaymentsService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
  ) {}

  /**
   * requestingUserId/input.requestingCompanyId: the approved owner asking for
   * insight into a competitor. targetCompanySlug: the rival being analyzed
   * — its report goes to the REQUESTER's own contact info, never to the
   * rival itself. On the paid path this only ever starts a checkout; the
   * report itself is generated and emailed by completeCheckout, once the
   * callback confirms payment actually succeeded.
   */
  async requestReport(
    requestingUserId: string,
    targetCompanySlug: string,
    input: RivalAnalyticsRequestInput,
  ): Promise<RivalAnalyticsRequestResult> {
    const ownership = await this.requireApprovedOwnership(requestingUserId, input.requestingCompanyId);
    const requestingCompany = await this.prisma.company.findUniqueOrThrow({ where: { id: input.requestingCompanyId } });
    const targetCompany = await this.requireDistinctTargetCompany(targetCompanySlug, input.requestingCompanyId);

    const access = decideRivalAnalyticsAccess({
      rivalAnalyticsTier: ownership.rivalAnalyticsTier,
      rivalAnalyticsFreeRequestUsed: ownership.rivalAnalyticsFreeRequestUsed,
    });

    if (access.allowed) {
      if (access.usedFreeCredit) {
        await this.prisma.companyOwner.update({
          where: { id: ownership.id },
          data: { rivalAnalyticsFreeRequestUsed: true },
        });
      }
      return this.deliverReport({
        requestingUserId,
        requestingCompany,
        targetCompany,
        requesterTier: ownership.rivalAnalyticsTier,
        usedFreeCredit: access.usedFreeCredit,
      });
    }

    return this.initiateCheckout(requestingUserId, requestingCompany, targetCompany, input.billing);
  }

  /**
   * Called from the public iyzico callback route once the browser lands back
   * from the hosted Checkout Form. Idempotent: iyzico can retry a callback,
   * and this is a no-op if the purchase was already marked PAID (or never
   * existed / already delivered) — never sends a second report for the same
   * purchase.
   */
  async completeCheckout(token: string): Promise<void> {
    const status = await this.payments.retrieveOneTimeCheckoutStatus(token).catch(() => null);
    if (!status?.paid || !status.conversationId) return;

    const purchase = await this.prisma.rivalAnalyticsPurchase.findUnique({ where: { id: status.conversationId } });
    if (!purchase || purchase.status === "PAID") return;

    const [requestingCompany, targetCompany] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: purchase.requestingCompanyId } }),
      this.prisma.company.findUnique({ where: { id: purchase.targetCompanyId } }),
    ]);
    if (!requestingCompany || !targetCompany) return;

    await this.prisma.rivalAnalyticsPurchase.update({
      where: { id: purchase.id },
      data: { status: "PAID", completedAt: new Date() },
    });

    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId: purchase.requestingUserId, companyId: purchase.requestingCompanyId } },
    });

    await this.deliverReport({
      requestingUserId: purchase.requestingUserId,
      requestingCompany,
      targetCompany,
      requesterTier: ownership?.rivalAnalyticsTier ?? null,
      usedFreeCredit: false,
    });
  }

  private async initiateCheckout(
    requestingUserId: string,
    requestingCompany: Company,
    targetCompany: Company,
    billing: RivalAnalyticsRequestInput["billing"],
  ): Promise<RivalAnalyticsRequestResult> {
    const priceTry = process.env.RIVAL_ANALYTICS_PULL_PRICE_TRY;
    if (!priceTry) {
      return { status: "PAYMENT_REQUIRED", priceNote: "Pricing for this report has not been configured yet." };
    }
    if (!billing) {
      throw new BadRequestException("Billing details are required to pay for a Rival Analytics report.");
    }

    const purchase = await this.prisma.rivalAnalyticsPurchase.create({
      data: {
        requestingCompanyId: requestingCompany.id,
        requestingUserId,
        targetCompanyId: targetCompany.id,
      },
    });

    // Same "must be this API server's own public address, reachable by
    // iyzico's servers" constraint documented on PaymentsService's Plus
    // checkout — a tunnel is needed to exercise this locally end-to-end.
    const apiPublicUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/v1`;

    try {
      const checkout = await this.payments.createOneTimeCheckout({
        conversationId: purchase.id,
        callbackUrl: `${apiPublicUrl.replace(/\/$/, "")}/rival-analytics/callback`,
        priceTry,
        basketId: purchase.id,
        itemName: `Rival Analytics: ${targetCompany.name}`,
        buyerName: billing.buyerName,
        buyerSurname: billing.buyerSurname,
        buyerIdentityNumber: billing.buyerIdentityNumber,
        buyerEmail: billing.buyerEmail,
        buyerGsmNumber: billing.buyerGsmNumber,
        billingAddress: billing.billingAddress,
      });
      return { status: "CHECKOUT_REQUIRED", checkoutFormContent: checkout.checkoutFormContent, token: checkout.token };
    } catch {
      // iyzico not configured (no API keys yet) or a live-call failure —
      // same "not set up yet" condition Plus checkout already surfaces to
      // its own frontend as a friendly message instead of a raw 5xx.
      await this.prisma.rivalAnalyticsPurchase.delete({ where: { id: purchase.id } });
      return {
        status: "PAYMENT_REQUIRED",
        priceNote: "Payment isn't set up yet — the site owner needs to add iyzico payment credentials first.",
      };
    }
  }

  private async deliverReport(params: {
    requestingUserId: string;
    requestingCompany: Company;
    targetCompany: Company;
    requesterTier: RivalAnalyticsTier | null;
    usedFreeCredit: boolean;
  }): Promise<RivalAnalyticsRequestResult> {
    const { requestingUserId, requestingCompany, targetCompany, requesterTier, usedFreeCredit } = params;

    const pdfBuffer = await buildRivalAnalyticsPdf(
      await this.aggregateReportData(targetCompany.id, targetCompany.name, requestingCompany.name, requesterTier),
    );

    const recipientEmail =
      requestingCompany.contactEmail ?? (await this.prisma.user.findUniqueOrThrow({ where: { id: requestingUserId } })).email;
    if (!recipientEmail) {
      throw new BadRequestException("No contact email on file to send this report to.");
    }

    await this.emailProvider.sendEmail(
      recipientEmail,
      `Rival Analytics: ${targetCompany.name}`,
      `Attached is your requested Rival Analytics report for ${targetCompany.name}, generated by iworkedthere.com.`,
      [{ filename: `rival-analytics-${targetCompany.slug}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
    );

    await this.prisma.auditLog.create({
      data: {
        actorUserId: requestingUserId,
        action: "RIVAL_ANALYTICS_REQUESTED",
        targetType: "Company",
        targetId: targetCompany.id,
        metadata: { requestingCompanyId: requestingCompany.id, usedFreeCredit },
      },
    });

    return { status: "SENT", recipientEmail, usedFreeCredit };
  }

  private async aggregateReportData(
    targetCompanyId: string,
    targetCompanyName: string,
    requestingCompanyName: string,
    requesterTier: RivalAnalyticsTier | null,
  ) {
    const [targetCompany, aggregate, publishedReviews] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: targetCompanyId } }),
      this.prisma.companyAggregateScore.findUnique({ where: { companyId: targetCompanyId } }),
      this.prisma.review.findMany({
        where: { companyId: targetCompanyId, status: "PUBLISHED" },
        select: { workplaceType: true, surveyAnswers: true, generalThoughts: true },
      }),
    ]);

    // Merged across every workplaceType the company has — this report is a
    // single at-a-glance summary, not a per-type breakdown like the public
    // company page.
    const allQuestionStats = (targetCompany.workplaceTypes as WorkplaceType[]).flatMap((workplaceType) => {
      const reviewsForType = publishedReviews.filter((r) => r.workplaceType === workplaceType);
      const questions = getQuestionsFor(workplaceType);
      return tallyQuestions(reviewsForType, questions);
    });

    const vibeFlags = (targetCompany.workplaceTypes as WorkplaceType[]).flatMap((workplaceType) => {
      const reviewsForType = publishedReviews.filter((r) => r.workplaceType === workplaceType);
      const questions = getQuestionsFor(workplaceType);
      return this.flagCalculator.computeVibeFlags({
        workplaceType,
        totalReviews: reviewsForType.length,
        questions: tallyQuestions(reviewsForType, questions),
      });
    });

    const commentThemes: ThemeMention[] = summarizeCommentThemes(
      publishedReviews.map((r) => r.generalThoughts).filter((t): t is string => !!t),
    );

    return {
      targetCompanyName,
      requestingCompanyName,
      requesterTier,
      generatedAt: new Date(),
      overallRating: aggregate && aggregate.reviewCount > 0 ? aggregate.overallAvg : null,
      reviewCount: aggregate?.reviewCount ?? 0,
      ...mostAgreedAndDisputed(allQuestionStats),
      vibeFlags,
      commentThemes,
    };
  }

  private async requireDistinctTargetCompany(targetSlug: string, requestingCompanyId: string): Promise<Company> {
    const targetCompany = await this.prisma.company.findUnique({ where: { slug: targetSlug } });
    if (!targetCompany) {
      throw new NotFoundException("Company not found");
    }
    if (targetCompany.id === requestingCompanyId) {
      throw new BadRequestException("Rival Analytics is for comparing against a different company, not your own.");
    }
    return targetCompany;
  }

  // Duplicated rather than cross-imported from OwnerService — matches this
  // codebase's existing module-per-feature convention.
  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company");
    }
    return ownership;
  }
}
