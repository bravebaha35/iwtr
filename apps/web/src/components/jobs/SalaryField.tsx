"use client";

import { useEffect, useState } from "react";
import { SALARY_CURRENCIES, SALARY_CURRENCY_SYMBOL, type SalaryCurrency, type SectorSalaryAverage } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { formatMoney, type SalaryDraft } from "@/lib/salary";
import { useI18n } from "@/lib/i18n/client";

/**
 * "Salary Information" ("Maaş Bilgisi") on posting or editing a job: the
 * monthly net amount (digits only) with ₺ / $ / € beside it - never
 * converted, a $ posting stays in $ - or the "Will be shared at the interview"
 * tick, which greys the amount out. Under it, the sector's average monthly ₺
 * salary from other job ads, once there is enough data to show one.
 */
export function SalaryField({
  companyId,
  value,
  onChange,
  showMissing = false,
}: {
  companyId: string;
  value: SalaryDraft;
  onChange: (next: SalaryDraft) => void;
  showMissing?: boolean;
}) {
  const { t, locale } = useI18n();
  const [average, setAverage] = useState<SectorSalaryAverage | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<SectorSalaryAverage>(`/my-companies/${companyId}/job-postings/salary-average`)
      .then((a) => {
        // Only a well-formed answer is shown.
        if (!cancelled) setAverage(a && typeof a.sector === "string" ? a : null);
      })
      .catch(() => {
        if (!cancelled) setAverage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const missing = showMissing && !value.atInterview && !(Number(value.amount) > 0);

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-foreground">{t("Salary Information")}</p>
      <div className={`flex items-stretch gap-2 ${value.atInterview ? "opacity-50" : ""}`}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          disabled={value.atInterview}
          value={value.amount}
          // Digits only: anything else typed or pasted is dropped.
          onChange={(e) => onChange({ ...value, amount: e.target.value.replace(/\D/g, "").replace(/^0+/, "") })}
          placeholder={t("Monthly net salary")}
          aria-label={t("Monthly net salary")}
          aria-invalid={missing || undefined}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm tabular-nums text-foreground disabled:cursor-not-allowed"
        />
        <div className="w-[5.5rem] shrink-0">
          <SingleSelectDropdown
            value={value.currency}
            options={SALARY_CURRENCIES.map((c) => ({ value: c, label: SALARY_CURRENCY_SYMBOL[c] }))}
            onChange={(v) => v && onChange({ ...value, currency: v as SalaryCurrency })}
            placeholder="₺"
            ariaLabel={t("Currency")}
            clearable={false}
            disabled={value.atInterview}
          />
        </div>
      </div>
      {value.currency !== "TRY" && !value.atInterview && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{t("Amounts in $ or € stay as they are, they are never converted.")}</p>
      )}

      <label className="mt-2.5 flex items-center gap-2 text-[13px] font-medium text-foreground">
        <input
          type="checkbox"
          checked={value.atInterview}
          onChange={(e) => onChange({ ...value, atInterview: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
        {t("Will be shared at the interview")}
      </label>

      {missing && (
        <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">
          {t("Enter the monthly salary, or tick that it will be shared at the interview")}
        </p>
      )}

      {average && (
        <div className="mt-3 rounded-lg bg-surface-muted px-3 py-2.5 text-[13px]">
          {average.averageMonthlyTry !== null ? (
            <>
              <p className="font-semibold text-foreground">
                {t("Sector average for {sector}: {amount} a month", {
                  sector: t(average.sector),
                  amount: formatMoney(average.averageMonthlyTry, "TRY", locale),
                })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("From {n} job ads with a salary in ₺.", { n: average.postingCount })}</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t("Not enough job ads with a salary in this sector yet to show an average.")}</p>
          )}
        </div>
      )}
    </div>
  );
}
