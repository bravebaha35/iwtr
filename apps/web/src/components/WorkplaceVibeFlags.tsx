"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CompanyVibeFlags, FlagColor, VibeFlag, WorkplaceType, YellowVibeFlag } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { collarPillClassName } from "@/lib/collarColors";
import { mapVibeFlags } from "@/utils/flagMapper";

const FLAG_CHIP_CLASSES: Record<FlagColor, string> = {
  GREEN: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
  RED: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};

// Same light/dark split as FLAG_CHIP_CLASSES above (light bg + dark text in
// light mode, dark bg + light text in dark mode) — an earlier fixed-tone
// version (same yellow-950/yellow-500 combo in both themes) read as a muddy
// low-contrast tan on a light background, so this follows the established
// green/red pattern instead for real parity: legible in both themes, not
// merely identical-looking in both.
const YELLOW_FLAG_CHIP_CLASSES =
  "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-300";

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

function YellowFlagChip({ flag }: { flag: YellowVibeFlag }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  // This chip lives inside WorkplaceVibeFlags' overflow-y-auto box, which
  // (per CSS overflow rules, setting overflow-y to non-visible forces
  // overflow-x to auto too) clips any absolutely-positioned child that
  // pokes past its edges — the old inline tooltip got cropped exactly
  // there. Rendering it through a portal into <body> with viewport-fixed
  // coordinates escapes that clipping entirely, so it always draws in
  // front, positioned from the ❓'s own bounding box.
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
  }, [open]);

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${YELLOW_FLAG_CHIP_CLASSES}`}
    >
      {/* Focusable/hoverable help affordance — the ❓ itself, not the whole
          chip, is the tooltip trigger per explicit design direction. */}
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-label={`Why: ${flag.explanation}`}
        className="relative cursor-help outline-none"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span aria-hidden="true">❓</span>
      </span>
      {flag.label}
      {open &&
        pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="pointer-events-none fixed z-[9999] w-56 -translate-x-1/2 whitespace-normal rounded-md bg-foreground px-3 py-2 text-left text-xs font-normal leading-snug text-background shadow-md"
          >
            {flag.explanation}
          </span>,
          document.body,
        )}
    </span>
  );
}

/**
 * Frontend rendering of the Dual-Opposite Flag Aggregation Engine plus the
 * Yellow Flag contradiction-pair engine
 * (apps/api/src/modules/flags/flag-calculator.service.ts, exposed via
 * GET /companies/:slug/vibe-flags). Every flag chip shown here is one the
 * backend already resolved (color, or yellow-pair label) — this component
 * (via utils/flagMapper.ts) only ever places it in the matching
 * Green/Yellow/Red column, never recomputes anything from raw survey data
 * itself.
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
      <div className="h-auto overflow-y-auto rounded-xl border border-border bg-surface p-6 font-sans lg:h-[672px]">
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

  const { green, yellow, red } = mapVibeFlags(activeSection);

  // Fixed height (matching CompanyDetailsBox, page.tsx) rather than
  // content-driven — every company must render at the exact same box size
  // regardless of flag count or color split. lg:h-[672px] was measured
  // against the old 2-column (green/red) grid's worst case and is being
  // kept as-is now that flags render as one flowing green→yellow→red row
  // instead — a flowing row wraps to fewer lines than a single 10-item
  // column ever did, so this figure stays a safe (if no longer tight)
  // upper bound. Re-measure if that stops holding. Scoped to lg:
  // because that's where the boxes sit side-by-side and their bottom
  // edges must align; on mobile the grid is single-column and the boxes
  // stack, so h-auto lets them flow instead of carrying dead space.
  // overflow-y-auto is now just an inert safety net.
  return (
    <div className="h-auto overflow-y-auto rounded-xl border border-border bg-surface p-6 font-sans lg:h-[672px]">
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
        <div className="flex flex-wrap items-start gap-2.5">
          {green.map((f) => (
            <FlagChip key={`${f.category}-${f.cluster}`} flag={f} />
          ))}
          {yellow.map((f) => (
            <YellowFlagChip key={f.id} flag={f} />
          ))}
          {red.map((f) => (
            <FlagChip key={`${f.category}-${f.cluster}`} flag={f} />
          ))}
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
