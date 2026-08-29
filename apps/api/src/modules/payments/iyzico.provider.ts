import { Injectable, NotImplementedException } from "@nestjs/common";
import Iyzipay from "iyzipay";
import type {
  CreateOneTimeCheckoutParams,
  CreateSubscriptionCheckoutParams,
  IPaymentProvider,
  OneTimeCheckoutInitResult,
  OneTimeCheckoutStatus,
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

  // One-off charge (e.g. a single Rival Analytics pull) — iyzico's hosted
  // "Checkout Form" (checkoutFormInitialize/checkoutForm), not the
  // subscription product above. The `@types/iyzipay` package types this
  // request as ThreeDSInitializePaymentRequestData, which declares
  // `paymentCard`/`installments` as required — but the real SDK request
  // builder (lib/requests/CreateCheckoutFormInitializeRequest.js) never
  // reads either field; a hosted Checkout Form collects the card on
  // iyzico's own page, not from us. The cast below reflects what the SDK
  // actually sends, verified against its source rather than the type
  // package.
  async createOneTimeCheckout(params: CreateOneTimeCheckoutParams): Promise<OneTimeCheckoutInitResult> {
    const iyzipay = this.client();

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: params.conversationId,
      callbackUrl: params.callbackUrl,
      price: params.priceTry,
      paidPrice: params.priceTry,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: params.basketId,
      buyer: {
        id: params.conversationId,
        name: params.buyerName,
        surname: params.buyerSurname,
        identityNumber: params.buyerIdentityNumber,
        email: params.buyerEmail,
        gsmNumber: params.buyerGsmNumber,
        registrationAddress: params.billingAddress.address,
        city: params.billingAddress.city,
        country: params.billingAddress.country,
        ip: "0.0.0.0",
      },
      shippingAddress: {
        contactName: params.billingAddress.contactName,
        city: params.billingAddress.city,
        country: params.billingAddress.country,
        address: params.billingAddress.address,
      },
      billingAddress: {
        contactName: params.billingAddress.contactName,
        city: params.billingAddress.city,
        country: params.billingAddress.country,
        address: params.billingAddress.address,
      },
      basketItems: [
        {
          id: params.basketId,
          name: params.itemName,
          category1: "Rival Analytics",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: params.priceTry,
        },
      ],
    };

    return new Promise((resolve, reject) => {
      iyzipay.checkoutFormInitialize.create(
        request as unknown as Parameters<typeof iyzipay.checkoutFormInitialize.create>[0],
        (err, result) => {
          if (err) return reject(err);
          if (result.status !== "success") {
            return reject(new Error(`iyzico checkout form initialize failed: ${JSON.stringify(result)}`));
          }
          resolve({ token: result.token, checkoutFormContent: result.checkoutFormContent });
        },
      );
    });
  }

  async retrieveOneTimeCheckoutStatus(token: string): Promise<OneTimeCheckoutStatus> {
    const iyzipay = this.client();

    return new Promise((resolve, reject) => {
      iyzipay.checkoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, token }, (err, result) => {
        if (err) return reject(err);
        if (result.status !== "success") {
          return reject(new Error(`iyzico checkout form retrieve failed: ${JSON.stringify(result)}`));
        }
        resolve({
          token: result.token,
          paid: result.paymentStatus === "SUCCESS",
          conversationId: result.conversationId ?? null,
        });
      });
    });
  }
}
