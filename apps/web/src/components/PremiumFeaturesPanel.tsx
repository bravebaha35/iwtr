"use client";

import { useState } from "react";
import { PRICING_FEATURE_ROWS, PRICING_TIERS, pricingFeature, tierRank, type PricingTierKey } from "@/lib/pricingTiers";

// "Target Company Scale" describes the tier itself, not a feature to visit
// — every other pricing-table row becomes one side-menu item.
const MENU_ITEMS = PRICING_FEATURE_ROWS.filter((row) => row.id !== "target-scale");

const BADGE_STYLES: Record<string, string> = {
  Blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Blue+": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Gold: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

// A small honesty tag on every panel below — none of this is backed by real
// usage tracking, job postings, exports, or seats yet (see CLAUDE.md: this
// repo is Phase 0/1 only). Frontend-only per this task's brief; nothing
// here calls an API that doesn't exist.
function PreviewTag() {
  return (
    <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Preview
    </span>
  );
}

function FeatureShell({
  title,
  tierNote,
  children,
}: {
  title: string;
  tierNote: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h4 className="font-semibold text-foreground">{title}</h4>
        <PreviewTag />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{tierNote}</p>
      {children}
    </div>
  );
}

function DisabledButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="cursor-not-allowed rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground opacity-60"
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function FeatureContent({ id, tierKey }: { id: string; tierKey: PricingTierKey }) {
  const feature = pricingFeature(id);
  const value = feature.values[tierKey];

  switch (id) {
    case "verified-badge":
      return (
        <FeatureShell title={feature.label} tierNote={`Your current tier: ${value}.`}>
          {value === "No" ? (
            <p className="text-sm text-muted-foreground">No verified badge on this tier.</p>
          ) : (
            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_STYLES[value] ?? ""}`}>
              {value}
            </span>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            The badge would appear next to your company name across the site, distinct from the existing free
            &quot;Verified&quot; badge shown above (which tracks your Plus subscription separately).
          </p>
        </FeatureShell>
      );

    case "comment-response":
      return (
        <FeatureShell title={feature.label} tierNote={`Your current tier: ${value}.`}>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full w-0 rounded-full bg-brand-600" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">0 replies used this month.</p>
        </FeatureShell>
      );

    case "hr-analytics":
      return (
        <FeatureShell title={feature.label} tierNote={value}>
          <p className="text-sm text-muted-foreground">
            This expanded view is in development. The real, working slice of it today is the{" "}
            <strong className="text-foreground">Reviews &amp; Ratings</strong> and{" "}
            <strong className="text-foreground">Rival Analytics</strong> sections above, which already show your
            company&apos;s Q&amp;A, Workplace Vibe Flags, and comment themes.
          </p>
        </FeatureShell>
      );

    case "benchmarking":
      return (
        <FeatureShell title={feature.label} tierNote={value}>
          {value === "No" ? (
            <p className="text-sm text-muted-foreground">Not included on this tier.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">Your company</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <div className="h-full w-0 rounded-full bg-brand-600" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">Industry average</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <div className="h-full w-0 rounded-full bg-muted-foreground/40" />
                </div>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">Fills in once enough published reviews exist.</p>
            </div>
          )}
        </FeatureShell>
      );

    case "job-ads":
      return (
        <FeatureShell title={feature.label} tierNote={`Your current tier: ${value}.`}>
          <DisabledButton>+ Post a job ad</DisabledButton>
          <div className="mt-4">
            <EmptyState text="No active job ads yet." />
          </div>
        </FeatureShell>
      );

    case "candidate-tracking":
      return (
        <FeatureShell title={feature.label} tierNote={value}>
          <EmptyState text="No applicants yet." />
        </FeatureShell>
      );

    case "export-data":
      return (
        <FeatureShell title={feature.label} tierNote={`Your current tier: ${value}.`}>
          <div className="flex gap-2">
            <DisabledButton>Export as PDF</DisabledButton>
            <DisabledButton>Export as Excel</DisabledButton>
          </div>
        </FeatureShell>
      );

    case "hr-seats":
      return (
        <FeatureShell title={feature.label} tierNote={`Your current tier: ${value}.`}>
          <p className="text-sm text-foreground">1 seat used (you).</p>
          <div className="mt-3">
            <DisabledButton>+ Invite a teammate</DisabledButton>
          </div>
        </FeatureShell>
      );

    case "support":
      return (
        <FeatureShell title={feature.label} tierNote={value}>
          <ul className="space-y-2 text-sm text-foreground">
            <li>Email support — available on every tier.</li>
            <li className={tierKey === "pro" || tierKey === "enterprise" ? "" : "text-muted-foreground"}>
              Prioritized mail (4-hour response) — Pro and Enterprise.
            </li>
            <li className={tierKey === "enterprise" ? "" : "text-muted-foreground"}>Live chat — Enterprise only.</li>
          </ul>
        </FeatureShell>
      );

    default:
      return null;
  }
}

function LockedFeature({
  label,
  lockedBelowRank,
  onOpenPricing,
}: {
  label: string;
  lockedBelowRank: number;
  onOpenPricing: () => void;
}) {
  const minTier = PRICING_TIERS.find((t) => t.rank === lockedBelowRank);
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-2xl">🔒</div>
      <h4 className="mb-1 font-semibold text-foreground">{label}</h4>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        Available starting on the {minTier?.label} plan.
      </p>
      <button
        type="button"
        onClick={onOpenPricing}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        See plans
      </button>
    </div>
  );
}

export function PremiumFeaturesPanel({
  tierKey,
  onOpenPricing,
}: {
  tierKey: PricingTierKey;
  onOpenPricing: () => void;
}) {
  const [activeId, setActiveId] = useState(MENU_ITEMS[0].id);
  const rank = tierRank(tierKey);
  const active = MENU_ITEMS.find((item) => item.id === activeId) ?? MENU_ITEMS[0];
  const activeLocked = (active.lockedBelowRank ?? 0) > rank;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="mb-1 font-semibold text-foreground">Premium Features</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        What&apos;s available on your plan, and what unlocks on a higher one.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
        <nav className="flex flex-col gap-1">
          {MENU_ITEMS.map((item) => {
            const itemLocked = (item.lockedBelowRank ?? 0) > rank;
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "bg-brand-100 font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-200"
                    : "text-foreground hover:bg-surface-muted"
                } ${itemLocked ? "opacity-60" : ""}`}
              >
                <span className="flex items-center gap-1.5">
                  {itemLocked && <span aria-hidden>🔒</span>}
                  {item.label}
                </span>
                {itemLocked && (
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    For {PRICING_TIERS.find((t) => t.rank === item.lockedBelowRank)?.label}+ Members
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="rounded-xl border border-border bg-surface-muted p-5">
          {activeLocked ? (
            <LockedFeature label={active.label} lockedBelowRank={active.lockedBelowRank ?? 0} onOpenPricing={onOpenPricing} />
          ) : (
            <FeatureContent id={active.id} tierKey={tierKey} />
          )}
        </div>
      </div>
    </div>
  );
}
