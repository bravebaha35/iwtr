"use client";

import type { JobSalary } from "@iwtr/shared-types";
import { PerkSymbols } from "@/components/perks/PerkSymbols";
import { RiskScoreBadge } from "@/components/jobs/RiskScoreBadge";
import { salaryLine } from "@/lib/salary";
import { useI18n } from "@/lib/i18n/client";

/**
 * The bottom of an opened job card (the expanded card on Jobs, and each card
 * on a company's Job Postings tab), owner's layout of 2026-10-29: a thin
 * line, then in this order the Salary Information, the company's perks as
 * round symbols, and (where asked for) the Risk Score word. Renders nothing
 * when there is none of the three to show.
 */
export function JobCardFacts({
  salary,
  perks,
  riskScore,
  className = "",
}: {
  salary: JobSalary | null | undefined;
  perks: readonly string[] | undefined;
  // Omit to leave the Risk Score out (the company page's own job cards).
  riskScore?: number | null;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const pay = salaryLine(salary, locale, t);
  const hasPerks = (perks?.length ?? 0) > 0;
  const hasRisk = riskScore !== undefined && riskScore !== null;
  if (!pay && !hasPerks && !hasRisk) return null;
  return (
    <div className={`border-t border-border pt-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {pay && (
          <p className="text-sm font-semibold tabular-nums text-foreground">
            <span className="sr-only">{t("Salary Information")}: </span>
            {pay}
          </p>
        )}
        {hasPerks && <PerkSymbols perks={perks!} />}
        {hasRisk && <RiskScoreBadge riskScore={riskScore} short className="ml-auto" />}
      </div>
    </div>
  );
}
