import type { BillingAddress } from "@iwtr/shared-types";

// A single, non-recurring charge — distinct from the subscription checkout
// below (Plus is a recurring plan; a Rival Analytics pull is a one-off
// purchase with its own price per request, not a pricing-plan reference
// code).
export interface CreateOneTimeCheckoutParams {
  conversationId: string;
  callbackUrl: string;
  priceTry: string;
  basketId: string;
  itemName: string;
  buyerName: string;
  buyerSurname: string;
  buyerIdentityNumber: string;
  buyerEmail: string;
  buyerGsmNumber?: string;
  billingAddress: BillingAddress;
}

export interface OneTimeCheckoutInitResult {
  token: string;
  checkoutFormContent: string;
}

export interface OneTimeCheckoutStatus {
  token: string;
  paid: boolean;
  conversationId: string | null;
}

export interface CreateSubscriptionCheckoutParams {
  // Correlates the checkout back to a CompanyOwner row once the callback
  // arrives — the provider echoes this back as conversationId.
  conversationId: string;
  callbackUrl: string;
  buyerName: string;
  buyerSurname: string;
  buyerIdentityNumber: string;
  buyerEmail: string;
  buyerGsmNumber?: string;
  billingAddress: BillingAddress;
}

export interface SubscriptionCheckoutInitResult {
  token: string;
  checkoutFormContent: string;
}

export interface SubscriptionCheckoutStatus {
  subscriptionReferenceCode: string;
  status: "ACTIVE" | "PENDING" | "OTHER";
  conversationId: string | null;
}

// Swappable payment-provider boundary — iyzico is the only implementation
// today (see IyzicoProvider), but nothing above this interface (payments
// module routes/service, tier-gating, badge auto-toggle) depends on iyzico
// specifically.
export interface IPaymentProvider {
  createSubscriptionCheckout(params: CreateSubscriptionCheckoutParams): Promise<SubscriptionCheckoutInitResult>;
  retrieveSubscriptionCheckoutStatus(token: string): Promise<SubscriptionCheckoutStatus>;
  createOneTimeCheckout(params: CreateOneTimeCheckoutParams): Promise<OneTimeCheckoutInitResult>;
  retrieveOneTimeCheckoutStatus(token: string): Promise<OneTimeCheckoutStatus>;
}
