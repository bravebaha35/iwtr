import { z } from "zod";
import { checkoutBillingInputSchema } from "./payment";

// The HR Analytics Report: one company's own anonymous review data as a
// two-page PDF (Vibe Flags + Risk Score history, then every survey question
// as percentages). Enterprise gets it as part of the plan, Pro gets one per
// calendar month, and anyone can buy one for HR_REPORT_PRICE_TRY.

export const HR_REPORT_PRICE_TRY = "199.99";
// How the price is written on screen, Turkish style.
export const HR_REPORT_PRICE_LABEL = "199,99₺";

export const hrReportStatusSchema = z.enum(["AWAITING_PAYMENT", "QUEUED", "RUNNING", "READY", "FAILED"]);
export type HrReportStatus = z.infer<typeof hrReportStatusSchema>;

export const hrReportAccessSchema = z.enum(["PLAN", "MONTHLY_QUOTA", "PAID"]);
export type HrReportAccess = z.infer<typeof hrReportAccessSchema>;

export const hrReportJobSchema = z.object({
  id: z.string().uuid(),
  status: hrReportStatusSchema,
  access: hrReportAccessSchema,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
});
export type HrReportJob = z.infer<typeof hrReportJobSchema>;

// What the next "Generate Report" click will do. No review counts in here,
// only whether the company has enough reviews for a report at all.
export const hrReportAllowanceSchema = z.object({
  // INCLUDED: Enterprise. MONTHLY_QUOTA: Pro with this month's report unused.
  // PAID_CREDIT: a paid report failed and can be rebuilt for free.
  // PAYMENT_REQUIRED: everyone else.
  mode: z.enum(["INCLUDED", "MONTHLY_QUOTA", "PAID_CREDIT", "PAYMENT_REQUIRED"]),
  // Pro only: reports left this month (0 or 1) and the day it refills.
  quotaRemaining: z.number().int().min(0).nullable(),
  quotaResetsOn: z.string().nullable(),
  priceTry: z.string(),
  eligible: z.boolean(),
  ineligibleReason: z.string().nullable(),
});
export type HrReportAllowance = z.infer<typeof hrReportAllowanceSchema>;

export const hrReportOverviewSchema = z.object({
  allowance: hrReportAllowanceSchema,
  jobs: z.array(hrReportJobSchema),
});
export type HrReportOverview = z.infer<typeof hrReportOverviewSchema>;

// billing is needed only when the allowance says PAYMENT_REQUIRED; without
// it such a request is refused with 402.
export const hrReportRequestSchema = z
  .object({
    billing: checkoutBillingInputSchema.optional(),
  })
  .strict();
export type HrReportRequest = z.infer<typeof hrReportRequestSchema>;

export const hrReportRequestResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("QUEUED"), job: hrReportJobSchema }),
  z.object({ status: z.literal("CHECKOUT_REQUIRED"), job: hrReportJobSchema, checkoutFormContent: z.string() }),
]);
export type HrReportRequestResult = z.infer<typeof hrReportRequestResultSchema>;
