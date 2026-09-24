"use client";

import { BENEFIT_KEYS, BENEFIT_LABELS, type BenefitKey, type CompensationRequestBody } from "@iwtr/shared-types";

// The explicit-consent sentence for the Sector Benchmark Report, verbatim
// from the product brief. Needs a lawyer's sign-off before launch (see
// docs/superpowers/specs/2026-09-24-sector-benchmark-report-design.md).
export const KVKK_BENCHMARK_CONSENT_TEXT =
  "Maaş verimin KVKK kapsamında tamamen anonimleştirilerek sektörel istatistik oluşturulması ve ticari amaçlarla işlenip üçüncü taraflara raporlanması için Açık Rızamı veriyorum.";

export interface CompensationDraft {
  consent: boolean;
  salary: string;
  benefits: BenefitKey[];
}

export const EMPTY_COMPENSATION: CompensationDraft = { consent: false, salary: "", benefits: [] };

/**
 * What gets sent with the review: nothing at all unless the consent box is
 * ticked and something was actually filled in. The API applies the same
 * consent rule again on its side, so this is a courtesy, not the guard.
 */
export function toCompensationBody(draft: CompensationDraft): CompensationRequestBody | undefined {
  if (!draft.consent) return undefined;
  if (draft.salary.trim() === "" && draft.benefits.length === 0) return undefined;
  return {
    hasConsentedToCommercialBenchmarking: true,
    monthlyNetSalary: draft.salary.trim() || undefined,
    benefits: draft.benefits,
  };
}

/**
 * Optional salary + benefits block at the end of the review form. The
 * consent checkbox always starts unticked; without it nothing here is sent.
 */
export function CompensationFields({
  value,
  onChange,
}: {
  value: CompensationDraft;
  onChange: (next: CompensationDraft) => void;
}) {
  const toggleBenefit = (benefit: BenefitKey) =>
    onChange({
      ...value,
      benefits: value.benefits.includes(benefit)
        ? value.benefits.filter((b) => b !== benefit)
        : [...value.benefits, benefit],
    });
  const filledWithoutConsent = !value.consent && (value.salary.trim() !== "" || value.benefits.length > 0);

  return (
    <fieldset className="border-t border-border pt-3">
      <legend className="text-sm font-semibold text-foreground">Salary &amp; benefits (optional)</legend>

      <label htmlFor="review-monthly-net-salary" className="mt-2 block text-xs font-medium text-muted-foreground">
        Monthly net salary
      </label>
      <div className="mt-1 flex border border-border bg-surface focus-within:border-river-600 dark:focus-within:border-river-300">
        <span
          aria-hidden="true"
          className="flex w-11 shrink-0 items-center justify-center bg-slate-dam font-grotesk text-lg font-bold text-birch dark:bg-birch dark:text-slate-dam"
        >
          ₺
        </span>
        <input
          id="review-monthly-net-salary"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={20}
          value={value.salary}
          onChange={(e) => onChange({ ...value, salary: e.target.value })}
          placeholder="45.000"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-grotesk text-lg font-semibold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <label className="mt-2 flex items-start gap-2">
        <input
          type="checkbox"
          checked={value.consent}
          onChange={(e) => onChange({ ...value, consent: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="text-xs text-muted-foreground">{KVKK_BENCHMARK_CONSENT_TEXT}</span>
      </label>
      {filledWithoutConsent && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Tick the consent box to include this — otherwise it won&apos;t be saved.
        </p>
      )}

      <p className="mt-3 text-xs font-medium text-muted-foreground">Benefits you receive(d)</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {BENEFIT_KEYS.map((benefit) => {
          const selected = value.benefits.includes(benefit);
          return (
            <button
              key={benefit}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleBenefit(benefit)}
              className={
                selected
                  ? "border border-river-600 bg-river-600 px-2.5 py-1 text-xs font-medium text-white"
                  : "border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
              }
            >
              {BENEFIT_LABELS[benefit]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
