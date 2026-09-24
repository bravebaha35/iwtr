import { z } from "zod";

// Sector Benchmark Report — see
// docs/superpowers/specs/2026-09-24-sector-benchmark-report-design.md.

export const BENEFIT_KEYS = [
  "MEAL_CARD",
  "TRANSPORT",
  "PRIVATE_HEALTH_INSURANCE",
  "BONUS",
  "PRIVATE_PENSION",
  "REMOTE_WORK_ALLOWANCE",
  "TRAINING_BUDGET",
  "COMPANY_CAR",
  "GYM",
  "PHONE",
] as const;
export const benefitKeySchema = z.enum(BENEFIT_KEYS);
export type BenefitKey = z.infer<typeof benefitKeySchema>;

export const BENEFIT_LABELS: Record<BenefitKey, string> = {
  MEAL_CARD: "Meal card",
  TRANSPORT: "Transport / shuttle",
  PRIVATE_HEALTH_INSURANCE: "Private health insurance",
  BONUS: "Bonus",
  PRIVATE_PENSION: "Private pension (BES)",
  REMOTE_WORK_ALLOWANCE: "Remote-work allowance",
  TRAINING_BUDGET: "Training budget",
  COMPANY_CAR: "Company car",
  GYM: "Gym membership",
  PHONE: "Phone / phone allowance",
};

export const MIN_MONTHLY_NET_SALARY = 1_000;
export const MAX_MONTHLY_NET_SALARY = 10_000_000;

// "45.000", "₺45000", "45.000,50 TL", "45000.5" -> 45000; "" -> null. Turkish writing
// uses "." for thousands and "," for decimals, so a trailing separator
// followed by only 1-2 digits is kuruş and is dropped before the rest is
// reduced to digits; a 3-digit tail ("45.000") is a thousands group.
export function parseMonthlyNetSalary(raw: string): number | null {
  const withoutKurus = raw.trim().replace(/[.,]\d{1,2}\s*(tl|try|₺)?\s*$/i, "");
  const digits = withoutKurus.replace(/\D/g, "");
  // Blank means "not answered"; text with no digits at all ("abc") is an
  // answer that isn't a number.
  if (digits.length === 0) return withoutKurus.length === 0 ? null : Number.NaN;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : Number.NaN;
}

/**
 * The optional salary/benefits block at the end of the review form.
 *
 * KVKK gate: unless `hasConsentedToCommercialBenchmarking` is literally
 * `true`, the transform returns `null` — salary and benefits are dropped
 * here, at the API's validation layer, before any service code (let alone
 * the database) ever sees them. Output `null` also covers "consented but
 * left both fields empty".
 */
export const compensationInputSchema = z
  .object({
    hasConsentedToCommercialBenchmarking: z.boolean(),
    monthlyNetSalary: z.string().max(40).optional(),
    benefits: z.array(benefitKeySchema).max(BENEFIT_KEYS.length).optional(),
  })
  .transform((value, ctx) => {
    if (value.hasConsentedToCommercialBenchmarking !== true) return null;

    const salary = value.monthlyNetSalary ? parseMonthlyNetSalary(value.monthlyNetSalary) : null;
    if (
      salary !== null &&
      (Number.isNaN(salary) || salary < MIN_MONTHLY_NET_SALARY || salary > MAX_MONTHLY_NET_SALARY)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyNetSalary"],
        message: "Enter your monthly net salary as a number.",
      });
      return z.NEVER;
    }

    const benefits = [...new Set(value.benefits ?? [])];
    if (salary === null && benefits.length === 0) return null;
    return { monthlyNetSalary: salary, benefits };
  });
export type CompensationInput = z.output<typeof compensationInputSchema>;
export type CompensationRequestBody = z.input<typeof compensationInputSchema>;

export const sectorBenchmarkRequestSchema = z.object({
  // TURKEY = every company in the requester's sector; CITY = only those in
  // the requester's own company city.
  scope: z.enum(["TURKEY", "CITY"]),
});
export type SectorBenchmarkRequest = z.infer<typeof sectorBenchmarkRequestSchema>;

export const benchmarkReportStatusSchema = z.enum(["QUEUED", "RUNNING", "READY", "FAILED"]);
export type BenchmarkReportStatus = z.infer<typeof benchmarkReportStatusSchema>;

export const benchmarkReportJobSchema = z.object({
  id: z.string().uuid(),
  status: benchmarkReportStatusSchema,
  sectorCategory: z.string(),
  city: z.string().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
});
export type BenchmarkReportJob = z.infer<typeof benchmarkReportJobSchema>;

// Only ever percentile bands — never an average — rounded to the nearest
// 500 TL. respondentCount is how many distinct people the band is built on
// (always >= the k-anonymity minimum, or the year isn't reported at all).
export const salaryBandSchema = z.object({
  salaryYear: z.number().int(),
  bottom25: z.number().int(),
  median: z.number().int(),
  top75: z.number().int(),
  respondentCount: z.number().int(),
});
export type SalaryBand = z.infer<typeof salaryBandSchema>;
