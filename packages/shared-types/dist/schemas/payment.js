"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plusCheckoutInputSchema = exports.paidOwnerTierSchema = exports.checkoutBillingInputSchema = exports.billingAddressSchema = void 0;
const zod_1 = require("zod");
// Billing details collected fresh at checkout time for invoicing purposes —
// this is a completely separate concern from the reviewer PII vault (that
// system exists to anonymously verify a *reviewer*; this is a normal business
// billing detail for a *paying company*). Nothing here is persisted; it's
// passed straight through to the payment provider for the transaction/invoice.
exports.billingAddressSchema = zod_1.z.object({
    contactName: zod_1.z.string().min(1),
    city: zod_1.z.string().min(1),
    country: zod_1.z.string().min(1),
    address: zod_1.z.string().min(1),
    zipCode: zod_1.z.string().optional(),
});
// Shared by every "collect billing details, hand them to iyzico" flow —
// Plus/tier checkout below AND Rival Analytics' one-time report purchase
// (owner.ts's rivalAnalyticsRequestInputSchema), which needs the exact same
// buyer/invoice fields but has no "tier" of its own to attach.
exports.checkoutBillingInputSchema = zod_1.z.object({
    buyerName: zod_1.z.string().min(1),
    buyerSurname: zod_1.z.string().min(1),
    // Required by iyzico for the subscription customer record (billing/invoice
    // compliance) — not the same field or purpose as the reviewer TCKN in
    // piiOnboardingInputSchema, and never stored in our own database.
    buyerIdentityNumber: zod_1.z.string().regex(/^[0-9]{11}$/, "Must be 11 digits"),
    buyerEmail: zod_1.z.string().email(),
    buyerGsmNumber: zod_1.z.string().min(7).optional(),
    billingAddress: exports.billingAddressSchema,
});
// The 3 self-serve paid ranks (see OwnerTier's schema.prisma comment) —
// FREE is never a checkout target.
exports.paidOwnerTierSchema = zod_1.z.enum(["BLUE", "BLUE_PLUS", "ENTERPRISE"]);
exports.plusCheckoutInputSchema = exports.checkoutBillingInputSchema.extend({
    targetTier: exports.paidOwnerTierSchema,
});
