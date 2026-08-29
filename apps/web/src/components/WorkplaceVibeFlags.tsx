"use client";

import { useEffect, useState } from "react";
import type { CategoryKey, CompanyVibeFlags, FlagColor, VibeFlag, WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { collarPillClassName } from "@/lib/collarColors";

// Category ordering only (no visible headers any more — per explicit user
// request, the per-category grouping/dividers were removed so every flag
// from every category pools into one flat green/red list). Kept purely so
// that pooled order stays stable and matches the chart's own category
// sequence rather than whatever order the API happened to return.
const ROW_ORDER: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];

const FLAG_CHIP_CLASSES: Record<FlagColor, string> = {
  GREEN: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  RED: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};

function FlagChip({ flag }: { flag: VibeFlag }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${FLAG_CHIP_CLASSES[flag.color]}`}
    >
      <span aria-hidden="true">{flag.color === "GREEN" ? "✅" : "🚩"}</span>
      {flag.label}
    </span>
  );
}

/**
 * Frontend rendering of the Dual-Opposite Flag Aggregation Engine
 * (apps/api/src/modules/flags/flag-calculator.service.ts, exposed via
 * GET /companies/:slug/vibe-flags). Every flag chip shown here is one the
 * backend already resolved to a single color — this component only ever
 * places it in the matching Green/Red column per category row, never
 * recomputes anything from raw survey data itself.
 */
export function WorkplaceVibeFlags({ companySlug }: { companySlug: string }) {
  const [data, setData] = useState<CompanyVibeFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [manualActiveType, setManualActiveType] = useState<WorkplaceType | null>(null);

  useEffect(() => {
    apiGet<CompanyVibeFlags>(`/companies/${companySlug}/vibe-flags`)
      .then((result) => {
        setData(result);
        setLoadFailed(false);
      })
      .catch(() => {
        setData(null);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [companySlug]);

  if (loadFailed) {
    return (
      <div className="h-[545px] overflow-y-auto rounded-xl border border-border bg-surface p-6 font-sans">
        <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load workplace flags right now.</p>
      </div>
    );
  }

  const populated = data?.byWorkplaceType.filter((s) => s.totalReviews > 0) ?? [];
  const activeType =
    (manualActiveType && populated.some((s) => s.workplaceType === manualActiveType)
      ? manualActiveType
      : populated[0]?.workplaceType) ?? null;
  const activeSection = populated.find((s) => s.workplaceType === activeType) ?? null;

  // Flat pool across every category, ordered by ROW_ORDER, then split
  // purely by the color the backend already resolved — no per-category
  // grouping shown any more.
  const pooled = activeSection ? ROW_ORDER.flatMap((category) => activeSection.flags.filter((f) => f.category === category)) : [];
  const green = pooled.filter((f) => f.color === "GREEN");
  const red = pooled.filter((f) => f.color === "RED");

  // Fixed height (matching CompanyDetailsBox, page.tsx) rather than
  // content-driven — every company must render at the exact same box size
  // regardless of flag count or color split. The true worst case is NOT
  // "10 flags" evenly split 5-and-5 across the two columns — it's all 10
  // landing in a SINGLE column (a company with zero green or zero red
  // flags), since each column stacks independently. That single-column
  // case live-measured at 536.67px (10 chips, some 2-line-wrapping labels
  // like "Dangerous Service Shortcuts"); 545px is that plus a small buffer,
  // with overflow-y-auto as a safety net for anything that still doesn't
  // fit.
  return (
    <div className="h-[545px] overflow-y-auto rounded-xl border border-border bg-surface p-6 font-sans">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Workplace Vibe Flags
          {activeType && populated.length <= 1 && (
            <span className="font-normal text-muted-foreground"> — {workplaceTypeLabel(activeType)}</span>
          )}
        </h2>
        {populated.length > 1 && (
          <div className="flex gap-1.5">
            {populated.map((s) => (
              <button
                key={s.workplaceType}
                type="button"
                onClick={() => setManualActiveType(s.workplaceType)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${collarPillClassName(
                  s.workplaceType,
                  s.workplaceType === activeType,
                )}`}
              >
                {workplaceTypeLabel(s.workplaceType)}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeSection ? (
        <div className="grid grid-cols-2 gap-8">
          <div className="flex flex-col items-start gap-2.5">
            {green.map((f) => (
              <FlagChip key={`${f.category}-${f.cluster}`} flag={f} />
            ))}
          </div>
          <div className="flex flex-col items-start gap-2.5">
            {red.map((f) => (
              <FlagChip key={`${f.category}-${f.cluster}`} flag={f} />
            ))}
          </div>
        </div>
      ) : !loading ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center text-sm text-muted-foreground">
          <span className="text-3xl" aria-hidden="true">
            😔
          </span>
          <span>No reviews yet — flags will appear once this workplace has published reviews.</span>
        </div>
      ) : null}
    </div>
  );
}
