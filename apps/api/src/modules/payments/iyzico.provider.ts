import { Injectable, NotImplementedException } from "@nestjs/common";
import Iyzipay from "iyzipay";
import type {
  CreateSubscriptionCheckoutParams,
  IPaymentProvider,
  SubscriptionCheckoutInitResult,
  SubscriptionCheckoutStatus,
} from "./payment-provider.interface";

// Wired up once IYZICO_API_KEY / IYZICO_SECRET_KEY / IYZICO_BASE_URL are
// provided (see apps/api/.env.example) — same "throw until configured"
// pattern as Google/Apple sign-in in auth.service.ts. The subscription
// product + pricing plan are merchant-level catalog objects created once in
// the iyzico panel (or via a one-off script), not per-checkout, so their
// reference code is also an env var rather than something this class creates.
//
// Request/response field names below are taken directly from @types/iyzipay
// (the SDK's own TypeScript definitions), not guessed — but the actual
// server-to-server calls have never been exercised against a live iyzico
// sandbox in this environment (no credentials were available), so verify
// against a real checkout once real API keys are set up.
@Injectable()
export class IyzicoProvider implements IPaymentProvider {
  private client(): Iyzipay {
    const apiKey = process.env.IYZICO_API_KEY;
    const secretKey = process.env.IYZICO_SECRET_KEY;
    const uri = process.env.IYZICO_BASE_URL;
    if (!apiKey || !secretKey || !uri) {
      throw new NotImplementedException(
        "iyzico is not configured yet. Set IYZICO_API_KEY, IYZICO_SECRET_KEY, and IYZICO_BASE_URL once you have an iyzico merchant account.",
      );
    }
    return new Iyzipay({ apiKey, secretKey, uri });
  }

  private pricingPlanReferenceCode(): string {
    const code = process.env.IYZICO_PLUS_PRICING_PLAN_REFERENCE_CODE;
    if (!code) {
      throw new NotImplementedException(
        "No Plus-tier subscription plan configured yet. Create a subscription product + pricing plan in your iyzico panel and set IYZICO_PLUS_PRICING_PLAN_REFERENCE_CODE.",
      );
    }
    return code;
  }

  async createSubscriptionCheckout(
    params: CreateSubscriptionCheckoutParams,
  ): Promise<SubscriptionCheckoutInitResult> {
    const iyzipay = this.client();
    const pricingPlanReferenceCode = this.pricingPlanReferenceCode();

    return new Promise((resolve, reject) => {
      iyzipay.subscriptionCheckoutForm.initialize(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: params.conversationId,
          callbackUrl: params.callbackUrl,
          pricingPlanReferenceCode,
          customer: {
            name: params.buyerName,
            surname: params.buyerSurname,
            identityNumber: params.buyerIdentityNumber,
            email: params.buyerEmail,
            gsmNumber: params.buyerGsmNumber,
            billingAddress: params.billingAddress,
          },
        },
        (err, result) => {
          if (err) return reject(err);
          if (result.status !== "success") {
            return reject(new Error(`iyzico checkout initialize failed: ${JSON.stringify(result)}`));
          }
          resolve({ token: result.token, checkoutFormContent: result.checkoutFormContent });
        },
      );
    });
  }

  async retrieveSubscriptionCheckoutStatus(token: string): Promise<SubscriptionCheckoutStatus> {
    const iyzipay = this.client();

    return new Promise((resolve, reject) => {
      iyzipay.subscriptionCheckoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, token }, (err, result) => {
        if (err) return reject(err);
        if (result.status !== "success") {
          return reject(new Error(`iyzico checkout retrieve failed: ${JSON.stringify(result)}`));
        }
        resolve({
          subscriptionReferenceCode: result.referenceCode,
          status:
            result.subscriptionStatus === "ACTIVE"
              ? "ACTIVE"
              : result.subscriptionStatus === "PENDING"
                ? "PENDING"
                : "OTHER",
          conversationId: result.conversationId ?? null,
        });
      });
    });
  }
}
