"use client";

import { useEffect, useState } from "react";
import type { CategoryKey, CompanyVibeFlags, VibeFlag, YellowVibeFlag } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { mapVibeFlags } from "@/utils/flagMapper";
import { useWorkTypeView, WorkTypeSlide, WorkTypeSwitcher } from "@/components/companies/WorkTypeView";

// Short names for the five survey categories, in the order the rows show.
const CATEGORY_ROWS: { key: CategoryKey; label: string }[] = [
  { key: "corporateCulture", label: "Culture" },
  { key: "leadership", label: "Leadership" },
  { key: "infrastructure", label: "Resources" },
  { key: "workLifeBalance", label: "Work-life" },
  { key: "stability", label: "Stability" },
];

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function FlagGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

function SplitGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4v16" />
      <path d="M17 4v16" />
      <path d="M7 9h10" />
      <path d="M17 15H7" />
    </svg>
  );
}

// One flag: a tonal tile, green with a tick for a good sign, red with a
// flag for a warning. The colour sits in the wash and the glyph; the label
// stays readable body text in both themes.
function FlagTile({ flag }: { flag: VibeFlag }) {
  const good = flag.color === "GREEN";
  return (
    <li
      className={`flex min-w-0 items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-snug ${
        good
          ? "bg-emerald-600/10 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-100"
          : "bg-red-600/10 text-red-900 dark:bg-red-400/10 dark:text-red-100"
      }`}
    >
      <span className={`mt-px shrink-0 ${good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {good ? <CheckGlyph /> : <FlagGlyph />}
      </span>
      <span className="min-w-0 font-medium">
        <span className="sr-only">{good ? "Good sign: " : "Warning: "}</span>
        {flag.label}
      </span>
    </li>
  );
}

function MixedSignal({ flag }: { flag: YellowVibeFlag }) {
  return (
    <li className="flex gap-3 rounded-xl bg-amber-500/10 px-3 py-2.5 dark:bg-amber-400/10">
      <span className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400">
        <SplitGlyph />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-foreground">{flag.label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{flag.explanation}</span>
      </span>
    </li>
  );
}

/**
 * Frontend rendering of the Dual-Opposite Flag Aggregation Engine plus the
 * Yellow Flag contradiction-pair engine
 * (apps/api/src/modules/flags/flag-calculator.service.ts, exposed via
 * GET /companies/:slug/vibe-flags). Every flag shown here is one the backend
 * already resolved; this component only lays them out per survey category
 * and never recomputes anything from raw survey data.
 *
 * Laid out as a signal board: a one-line tally and a strip of ten marks
 * (one per flag, in row order) give the read at a glance, then the five
 * categories as rows of two flags each, then any mixed signals with their
 * reason written out. The work type on show comes from WorkTypeViewProvider,
 * shared with the rating illustration above, and every work type the
 * company lists can be opened, reviewed or not.
 */
export function WorkplaceVibeFlags({ companySlug }: { companySlug: string }) {
  const { types, active } = useWorkTypeView();
  const [data, setData] = useState<CompanyVibeFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

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

  const section = data?.byWorkplaceType.find((s) => s.workplaceType === active && s.totalReviews > 0) ?? null;
  const { green, yellow, red } = mapVibeFlags(section);
  const allFlags = [...green, ...red];
  const rows = CATEGORY_ROWS.map((row) => ({
    ...row,
    flags: allFlags.filter((f) => f.category === row.key).sort((a, b) => a.cluster - b.cluster),
  })).filter((row) => row.flags.length > 0);
  const strip = rows.flatMap((row) => row.flags);

  return (
    <div className="font-sans">
      <div className="mb-4 flex flex-col items-start gap-3">
        {types.length > 1 && <WorkTypeSwitcher className="-ml-1" />}
        <h2 className="text-xl text-foreground">
          Workplace Vibe Flags
          {types.length === 1 && <span className="font-normal text-muted-foreground"> for {workplaceTypeLabel(active)}</span>}
        </h2>
      </div>

      {loadFailed ? (
        <p className="text-sm text-red-600 dark:text-red-300">Couldn&apos;t load workplace flags right now.</p>
      ) : loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <div className="h-4 w-48 animate-pulse rounded bg-surface-muted" />
          <div className="mt-2 h-1.5 w-full animate-pulse rounded bg-surface-muted" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mt-2 h-10 w-full animate-pulse rounded-xl bg-surface-muted" />
          ))}
        </div>
      ) : (
        <WorkTypeSlide>
          {section ? (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{green.length}</span> good sign{green.length === 1 ? "" : "s"},{" "}
                  <span className="font-semibold tabular-nums text-foreground">{red.length}</span> warning{red.length === 1 ? "" : "s"}
                  <span className="text-muted-foreground"> from {section.totalReviews} {workplaceTypeLabel(active)} review{section.totalReviews === 1 ? "" : "s"}</span>
                </p>
                <div className="mt-2.5 flex gap-1" aria-hidden="true">
                  {strip.map((f) => (
                    <span
                      key={`${f.category}-${f.cluster}`}
                      className={`h-1.5 flex-1 rounded-full ${f.color === "GREEN" ? "bg-emerald-500 dark:bg-emerald-400" : "bg-red-500 dark:bg-red-400"}`}
                    />
                  ))}
                </div>
              </div>

              <dl className="flex flex-col gap-3">
                {rows.map((row) => (
                  <div key={row.key} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[5.5rem_1fr] sm:items-start sm:gap-3">
                    <dt className="pt-2.5 text-xs font-semibold text-muted-foreground">{row.label}</dt>
                    <dd>
                      <ul className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
                        {row.flags.map((f) => (
                          <FlagTile key={`${f.category}-${f.cluster}`} flag={f} />
                        ))}
                      </ul>
                    </dd>
                  </div>
                ))}
              </dl>

              {yellow.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-foreground">Mixed signals</h3>
                  <ul className="flex flex-col gap-2">
                    {yellow.map((f) => (
                      <MixedSignal key={f.id} flag={f} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface-muted px-5 py-6">
              <p className="text-sm font-semibold text-foreground">No {workplaceTypeLabel(active)} reviews yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Flags for this work type appear once someone who worked here in a {workplaceTypeLabel(active)} role publishes a review.
              </p>
            </div>
          )}
        </WorkTypeSlide>
      )}
    </div>
  );
}
