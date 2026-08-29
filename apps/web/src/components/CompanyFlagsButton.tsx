"use client";

import { useState, type MouseEvent } from "react";
import type { CategoryKey, CompanyVibeFlags, VibeFlag } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

const ROW_ORDER: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];
// "if there are any" — cap each color at 5 and simply omit a color with
// zero flags, rather than padding to a fixed 5-and-5.
const MAX_PER_COLOR = 5;

function FlagLine({ flag }: { flag: VibeFlag }) {
  const isGreen = flag.color === "GREEN";
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-medium ${
        isGreen ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
      }`}
    >
      <span aria-hidden="true">{isGreen ? "✅" : "🚩"}</span>
      {flag.label}
    </span>
  );
}

/**
 * Compact "i" button for a browse-grid CompanyCard: a summarized slice of
 * the same Dual-Opposite Flag Aggregation Engine data the full company page's
 * WorkplaceVibeFlags renders (GET /companies/:slug/vibe-flags) — at most 5
 * green and 5 red, never the full up-to-10-per-color list a company can
 * accumulate. Fetched lazily on first open rather than on card mount: a page
 * showing 24 cards would otherwise fire 24 requests just to populate a menu
 * most visitors never open.
 */
export function CompanyFlagsButton({ companySlug }: { companySlug: string }) {
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<CompanyVibeFlags | null>(null);

  function toggleOpen(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen((o) => !o);
    if (fetched) return;
    setFetched(true);
    setLoading(true);
    apiGet<CompanyVibeFlags>(`/companies/${companySlug}/vibe-flags`)
      .then((result) => setData(result))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }

  const section = data?.byWorkplaceType.find((s) => s.totalReviews > 0) ?? null;
  const pooled = section ? ROW_ORDER.flatMap((category) => section.flags.filter((f) => f.category === category)) : [];
  const green = pooled.filter((f) => f.color === "GREEN").slice(0, MAX_PER_COLOR);
  const red = pooled.filter((f) => f.color === "RED").slice(0, MAX_PER_COLOR);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Workplace flags summary"
        title="Workplace flags summary"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[11px] font-bold leading-none text-muted-foreground transition hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400"
      >
        i
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-[70] mt-1 w-56 rounded-lg border border-border bg-surface p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {loading && <p className="text-xs text-muted-foreground">Loading...</p>}
            {!loading && failed && (
              <p className="text-xs text-red-600 dark:text-red-400">Couldn&apos;t load flags right now.</p>
            )}
            {!loading && !failed && !section && <p className="text-xs text-muted-foreground">No reviews yet.</p>}
            {!loading && !failed && section && (
              <div className="flex flex-col gap-2.5">
                {green.length === 0 && red.length === 0 && (
                  <p className="text-xs text-muted-foreground">No flags yet.</p>
                )}
                {green.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {green.map((f) => (
                      <FlagLine key={`${f.category}-${f.cluster}`} flag={f} />
                    ))}
                  </div>
                )}
                {red.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {red.map((f) => (
                      <FlagLine key={`${f.category}-${f.cluster}`} flag={f} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
