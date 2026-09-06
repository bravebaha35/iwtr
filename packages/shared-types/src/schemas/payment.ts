import { z } from "zod";

// Billing details collected fresh at checkout time for invoicing purposes —
// this is a completely separate concern from the reviewer PII vault (that
// system exists to anonymously verify a *reviewer*; this is a normal business
// billing detail for a *paying company*). Nothing here is persisted; it's
// passed straight through to the payment provider for the transaction/invoice.
export const billingAddressSchema = z.object({
  contactName: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  address: z.string().min(1),
  zipCode: z.string().optional(),
});
export type BillingAddress = z.infer<typeof billingAddressSchema>;

// Shared by every "collect billing details, hand them to iyzico" flow —
// Plus/tier checkout below AND Rival Analytics' one-time report purchase
// (owner.ts's rivalAnalyticsRequestInputSchema), which needs the exact same
// buyer/invoice fields but has no "tier" of its own to attach.
export const checkoutBillingInputSchema = z.object({
  buyerName: z.string().min(1),
  buyerSurname: z.string().min(1),
  // Required by iyzico for the subscription customer record (billing/invoice
  // compliance) — not the same field or purpose as the reviewer TCKN in
  // piiOnboardingInputSchema, and never stored in our own database.
  buyerIdentityNumber: z.string().regex(/^[0-9]{11}$/, "Must be 11 digits"),
  buyerEmail: z.string().email(),
  buyerGsmNumber: z.string().min(7).optional(),
  billingAddress: billingAddressSchema,
});
export type CheckoutBillingInput = z.infer<typeof checkoutBillingInputSchema>;

// The 3 self-serve paid ranks (see OwnerTier's schema.prisma comment) —
// FREE is never a checkout target.
export const paidOwnerTierSchema = z.enum(["BLUE", "BLUE_PLUS", "ENTERPRISE"]);
export type PaidOwnerTier = z.infer<typeof paidOwnerTierSchema>;

export const plusCheckoutInputSchema = checkoutBillingInputSchema.extend({
  targetTier: paidOwnerTierSchema,
});
export type PlusCheckoutInput = z.infer<typeof plusCheckoutInputSchema>;
