"use client";

import { useEffect, useState } from "react";
import type { CompanySurveyStats, WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { collarPillClassName } from "@/lib/collarColors";
import { computeWorkplaceVibeFlags, type TriggeredFlag } from "@/utils/flagMapper";

const COLUMN_HEIGHT_CLASS = "h-96";

function FlagColumn({
  title,
  emoji,
  flags,
  emptyLabel,
}: {
  title: string;
  emoji: string;
  flags: TriggeredFlag[];
  emptyLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className={`thin-scrollbar flex-1 overflow-y-auto rounded-lg border border-border bg-background ${COLUMN_HEIGHT_CLASS}`}>
        {flags.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {flags.map((f) => (
              <li key={f.flag} className="flex items-start gap-2 px-3 py-2 text-sm text-foreground">
                <span aria-hidden="true">{emoji}</span>
                <span className="min-w-0 break-words">{f.flag}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Company-wide "vibe check" derived from the 25-question survey's aggregate
 * consensus (see utils/flagMapper.ts) — up to 10 green flags and up to 10
 * red flags per work-type, ranked strongest-first. Fetches the same
 * GET /companies/:slug/survey-stats endpoint SurveyHighlights already uses,
 * so no backend change is needed; this is purely a different lens on the
 * same per-question agree/disagree tallies.
 */
export function WorkplaceVibeFlags({ companySlug }: { companySlug: string }) {
  const [stats, setStats] = useState<CompanySurveyStats | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [manualActiveType, setManualActiveType] = useState<WorkplaceType | null>(null);

  useEffect(() => {
    apiGet<CompanySurveyStats>(`/companies/${companySlug}/survey-stats`)
      .then((data) => {
        setStats(data);
        setLoadFailed(false);
      })
      .catch(() => {
        setStats(null);
        setLoadFailed(true);
      });
  }, [companySlug]);

  if (loadFailed) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load workplace flags right now.</p>
      </div>
    );
  }

  const populated = stats?.byWorkplaceType.filter((s) => s.totalReviews > 0) ?? [];
  const activeType =
    (manualActiveType && populated.some((s) => s.workplaceType === manualActiveType)
      ? manualActiveType
      : populated[0]?.workplaceType) ?? null;
  const activeStats = populated.find((s) => s.workplaceType === activeType) ?? null;

  const { green, red } = activeStats ? computeWorkplaceVibeFlags(activeStats.workplaceType, activeStats.questions) : { green: [], red: [] };

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
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

      {activeStats ? (
        <div className="grid grid-cols-2 gap-4">
          <FlagColumn title="Green Flags" emoji="✅" flags={green} emptyLabel="No green flags surfaced yet." />
          <FlagColumn title="Red Flags" emoji="🚩" flags={red} emptyLabel="No red flags surfaced yet." />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No reviews yet — flags will appear once this workplace has published reviews.
        </p>
      )}
    </div>
  );
}
