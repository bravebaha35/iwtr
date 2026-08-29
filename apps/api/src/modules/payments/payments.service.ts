import { ForbiddenException, Injectable } from "@nestjs/common";
import type { PlanStatus, PlusCheckoutInput, PlusCheckoutResult } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { IyzicoProvider } from "./iyzico.provider";
import type { CreateOneTimeCheckoutParams, OneTimeCheckoutInitResult, OneTimeCheckoutStatus } from "./payment-provider.interface";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: IyzicoProvider,
  ) {}

  async initiatePlusCheckout(
    userId: string,
    companyId: string,
    input: PlusCheckoutInput,
  ): Promise<PlusCheckoutResult> {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company");
    }

    // iyzico's Checkout Form redirects the user's *browser* to this URL after
    // payment (a POST, not a server-to-server webhook) — it must be this API
    // server's own public address, not the web app's. Locally that's
    // localhost, which iyzico's real sandbox can't reach; a tunnel (e.g.
    // ngrok) is needed to actually exercise this end-to-end against iyzico,
    // same as any local webhook development.
    const apiPublicUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/v1`;
    const result = await this.provider.createSubscriptionCheckout({
      // The CompanyOwner row's own id is a stable, already-unique correlation
      // key — no extra table needed to track in-flight checkout attempts.
      conversationId: ownership.id,
      callbackUrl: `${apiPublicUrl.replace(/\/$/, "")}/payments/iyzico/callback`,
      buyerName: input.buyerName,
      buyerSurname: input.buyerSurname,
      buyerIdentityNumber: input.buyerIdentityNumber,
      buyerEmail: input.buyerEmail,
      buyerGsmNumber: input.buyerGsmNumber,
      billingAddress: input.billingAddress,
    });

    return { checkoutFormContent: result.checkoutFormContent, token: result.token };
  }

  // Deliberately thin and product-agnostic — unlike initiatePlusCheckout
  // above, this method knows nothing about Rival Analytics, ownership, or
  // free credits. That business logic lives in RivalAnalyticsService, which
  // calls this after it has already decided a charge is needed; keeping it
  // here would mean PaymentsModule importing RivalAnalyticsModule while
  // RivalAnalyticsModule imports PaymentsModule for this very method — a
  // circular module dependency for no real benefit.
  async createOneTimeCheckout(params: CreateOneTimeCheckoutParams): Promise<OneTimeCheckoutInitResult> {
    return this.provider.createOneTimeCheckout(params);
  }

  async retrieveOneTimeCheckoutStatus(token: string): Promise<OneTimeCheckoutStatus> {
    return this.provider.retrieveOneTimeCheckoutStatus(token);
  }

  // The callback iyzico posts to only carries a token — its trustworthiness
  // comes from immediately calling back into iyzico (using our own API
  // secret) to retrieve the authoritative status, never from trusting the
  // raw callback body itself.
  async handleCheckoutCallback(token: string): Promise<void> {
    const status = await this.provider.retrieveSubscriptionCheckoutStatus(token);
    if (!status.conversationId) return;

    const ownership = await this.prisma.companyOwner.findUnique({ where: { id: status.conversationId } });
    if (!ownership) return;

    await this.applySubscriptionStatus(
      ownership.id,
      status.status === "ACTIVE" ? "ACTIVE" : "PAST_DUE",
      status.subscriptionReferenceCode,
    );
  }

  // Split out from handleCheckoutCallback so the state-transition + badge
  // logic can be exercised directly (e.g. from a test or a support script)
  // without needing a live iyzico connection.
  async applySubscriptionStatus(
    companyOwnerId: string,
    planStatus: PlanStatus,
    subscriptionReferenceCode: string | null,
  ): Promise<void> {
    const ownership = await this.prisma.companyOwner.findUniqueOrThrow({ where: { id: companyOwnerId } });

    await this.prisma.companyOwner.update({
      where: { id: companyOwnerId },
      data: {
        // tier tracks *current* entitlement, not subscription history — once
        // planStatus stops being ACTIVE (past-due or canceled), the owner
        // reverts to Free rather than keeping a stale "Plus" label they no
        // longer have any privileges under (Plus-field editing already
        // requires planStatus === ACTIVE separately, but the label itself
        // should stop implying an active paid plan too).
        tier: planStatus === "ACTIVE" ? "PLUS" : "FREE",
        planStatus,
        iyzicoSubscriptionRef: subscriptionReferenceCode ?? ownership.iyzicoSubscriptionRef,
        planRenewsAt: planStatus === "ACTIVE" ? this.oneMonthFromNow() : ownership.planRenewsAt,
      },
    });

    await this.syncVerifiedBadge(ownership.companyId);

    await this.prisma.auditLog.create({
      data: {
        actorUserId: null,
        action: "IYZICO_SUBSCRIPTION_STATUS_APPLIED",
        targetType: "CompanyOwner",
        targetId: companyOwnerId,
        metadata: { planStatus, subscriptionReferenceCode },
      },
    });
  }

  // The verified badge is auto-toggled, never settable directly — it exists
  // solely as a derived signal of "has an active Plus subscription right
  // now", so it can never drift out of sync with the thing it represents.
  private async syncVerifiedBadge(companyId: string): Promise<void> {
    const activePlusOwner = await this.prisma.companyOwner.findFirst({
      where: { companyId, tier: "PLUS", planStatus: "ACTIVE" },
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: { isVerifiedBadge: !!activePlusOwner },
    });
  }

  private oneMonthFromNow(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  }
}
