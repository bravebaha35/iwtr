import { SECTOR_SALARY_MIN_COMPANIES, type JobSalary, type JobSalaryInput, type SalaryCurrency } from "@iwtr/shared-types";

// Salary Information on a job posting (2026-10-29). Pure helpers so the
// mapping and the sector average are unit-testable without a database.

export interface SalaryColumns {
  salaryAmount: number | null;
  salaryCurrency: SalaryCurrency | null;
  salaryAtInterview: boolean;
}

// The row's three columns as the public `salary` field: null for a posting
// made before salaries existed.
export function toJobSalary(row: Partial<SalaryColumns>): JobSalary | null {
  if (row.salaryAtInterview) return { amount: null, currency: null, atInterview: true };
  if (row.salaryAmount != null && row.salaryCurrency) {
    return { amount: row.salaryAmount, currency: row.salaryCurrency, atInterview: false };
  }
  return null;
}

// The owner's input as the columns to store. The schema already refused an
// amount without a currency (and the reverse) unless the interview tick is on.
export function salaryColumns(input: JobSalaryInput): SalaryColumns {
  if (input.atInterview) return { salaryAmount: null, salaryCurrency: null, salaryAtInterview: true };
  return { salaryAmount: input.amount ?? null, salaryCurrency: input.currency ?? null, salaryAtInterview: false };
}

export function sameSalary(a: SalaryColumns, b: Partial<SalaryColumns>): boolean {
  return (
    a.salaryAtInterview === (b.salaryAtInterview ?? false) &&
    a.salaryAmount === (b.salaryAmount ?? null) &&
    a.salaryCurrency === (b.salaryCurrency ?? null)
  );
}

// The sector's average monthly ₺ salary from job ads that gave one. Each
// company counts once (the mean of its own ads), so one company posting many
// ads can't pull the figure. Null until ads from SECTOR_SALARY_MIN_COMPANIES
// different companies are behind it, so it never reveals one company's pay.
export function sectorAverage(rows: { companyId: string; salaryAmount: number | null }[]): {
  averageMonthlyTry: number | null;
  postingCount: number;
} {
  const byCompany = new Map<string, number[]>();
  for (const r of rows) {
    if (r.salaryAmount == null) continue;
    const list = byCompany.get(r.companyId) ?? [];
    list.push(r.salaryAmount);
    byCompany.set(r.companyId, list);
  }
  const postingCount = [...byCompany.values()].reduce((n, l) => n + l.length, 0);
  if (byCompany.size < SECTOR_SALARY_MIN_COMPANIES) return { averageMonthlyTry: null, postingCount };
  const companyMeans = [...byCompany.values()].map((l) => l.reduce((s, v) => s + v, 0) / l.length);
  const mean = companyMeans.reduce((s, v) => s + v, 0) / companyMeans.length;
  return { averageMonthlyTry: Math.round(mean), postingCount };
}
