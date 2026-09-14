import { z } from "zod";
export declare const billingAddressSchema: z.ZodObject<{
    contactName: z.ZodString;
    city: z.ZodString;
    country: z.ZodString;
    address: z.ZodString;
    zipCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    city: string;
    country: string;
    contactName: string;
    address: string;
    zipCode?: string | undefined;
}, {
    city: string;
    country: string;
    contactName: string;
    address: string;
    zipCode?: string | undefined;
}>;
export type BillingAddress = z.infer<typeof billingAddressSchema>;
export declare const checkoutBillingInputSchema: z.ZodObject<{
    buyerName: z.ZodString;
    buyerSurname: z.ZodString;
    buyerIdentityNumber: z.ZodString;
    buyerEmail: z.ZodString;
    buyerGsmNumber: z.ZodOptional<z.ZodString>;
    billingAddress: z.ZodObject<{
        contactName: z.ZodString;
        city: z.ZodString;
        country: z.ZodString;
        address: z.ZodString;
        zipCode: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        city: string;
        country: string;
        contactName: string;
        address: string;
        zipCode?: string | undefined;
    }, {
        city: string;
        country: string;
        contactName: string;
        address: string;
        zipCode?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    buyerName: string;
    buyerSurname: string;
    buyerIdentityNumber: string;
    buyerEmail: string;
    billingAddress: {
        city: string;
        country: string;
        contactName: string;
        address: string;
        zipCode?: string | undefined;
    };
    buyerGsmNumber?: string | undefined;
}, {
    buyerName: string;
    buyerSurname: string;
    buyerIdentityNumber: string;
    buyerEmail: string;
    billingAddress: {
        city: string;
        country: string;
        contactName: string;
        address: string;
        zipCode?: string | undefined;
    };
    buyerGsmNumber?: string | undefined;
}>;
export type CheckoutBillingInput = z.infer<typeof checkoutBillingInputSchema>;
export declare const paidOwnerTierSchema: z.ZodEnum<["BLUE", "BLUE_PLUS", "ENTERPRISE"]>;
export type PaidOwnerTier = z.infer<typeof paidOwnerTierSchema>;
export declare const plusCheckoutInputSchema: z.ZodObject<{
    buyerName: z.ZodString;
    buyerSurname: z.ZodString;
    buyerIdentityNumber: z.ZodString;
    buyerEmail: z.ZodString;
    buyerGsmNumber: z.ZodOptional<z.ZodString>;
    billingAddress: z.ZodObject<{
        contactName: z.ZodString;
        city: z.ZodString;
        country: z.ZodString;
        address: z.ZodString;
        zipCode: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        city: string;
        country: string;
        contactName: string;
        address: string;
        zipCode?: string | undefined;
    }, {
        city: string;
        country: string;
        contactName: string;
        address: string;
        zipCode?: string | undefined;
    }>;
} & {
    targetTier: z.ZodEnum<["BLUE", "BLUE_PLUS", "ENTERPRISE"]>;
}, "strip", z.ZodTypeAny, {
    buyerName: string;
    buyerSurname: string;
    buyerIdentityNumber: string;
    buyerEmail: string;
    billingAddress: {
        city: string;
        country: string;
        contactName: string;
        address: string;
        zipCode?: string | undefined;
    };
    targetTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE";
    buyerGsmNumber?: string | undefined;
}, {
    buyerName: string;
    buyerSurname: string;
    buyerIdentityNumber: string;
    buyerEmail: string;
    billingAddress: {
        city: string;
        country: string;
        contactName: string;
        address: string;
        zipCode?: string | undefined;
    };
    targetTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE";
    buyerGsmNumber?: string | undefined;
}>;
export type PlusCheckoutInput = z.infer<typeof plusCheckoutInputSchema>;
