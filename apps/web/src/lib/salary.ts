import type { JobSalary, JobSalaryInput, SalaryCurrency } from "@iwtr/shared-types";
import { intlLocale, plainT, type Locale, type TFn } from "@/lib/i18n/core";

// Salary Information helpers (2026-10-29).

// What the Salary Information field holds while being edited: the amount as
// typed digits (so an empty box stays empty), the currency, the tick.
export interface SalaryDraft {
  amount: string;
  currency: SalaryCurrency;
  atInterview: boolean;
}

export const EMPTY_SALARY_DRAFT: SalaryDraft = { amount: "", currency: "TRY", atInterview: false };

export function draftFromSalary(salary: JobSalary | null): SalaryDraft {
  if (!salary) return EMPTY_SALARY_DRAFT;
  if (salary.atInterview) return { ...EMPTY_SALARY_DRAFT, atInterview: true };
  return { amount: salary.amount != null ? String(salary.amount) : "", currency: salary.currency ?? "TRY", atInterview: false };
}

// Complete enough to send: an amount, or the interview tick.
export function salaryDraftComplete(d: SalaryDraft): boolean {
  return d.atInterview || Number(d.amount) > 0;
}

export function salaryInputFromDraft(d: SalaryDraft): JobSalaryInput {
  if (d.atInterview) return { atInterview: true };
  return { atInterview: false, amount: Number(d.amount), currency: d.currency };
}

// "₺45.000" / "$2,500": the owner's own currency, never converted.
export function formatMoney(amount: number, currency: SalaryCurrency, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(amount);
}

// The one line a job card shows: "₺45.000 / month", or that it is shared at
// the interview. Null when the posting says nothing about pay.
export function salaryLine(salary: JobSalary | null | undefined, locale: Locale, t: TFn = plainT): string | null {
  if (!salary) return null;
  if (salary.atInterview) return t("Salary shared at the interview");
  if (salary.amount == null || !salary.currency) return null;
  return t("{amount} / month", { amount: formatMoney(salary.amount, salary.currency, locale) });
}
