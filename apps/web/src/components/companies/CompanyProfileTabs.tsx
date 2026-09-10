"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SocialFeed } from "@/components/social/SocialFeed";
import { CompanyJobPostings } from "./CompanyJobPostings";

// The consolidated company-profile hub. Sits directly under the page's
// logo/banner header (rendered by the Server Component in
// app/companies/[slug]/page.tsx) and splits everything below it into three
// independent streams:
//
//   Ratings      — the reviews + overall scores (passed in as `ratings`,
//                  server-rendered by the page so this tab keeps full SSR)
//   IWT Social   — this company's own social posts (GET /social/companies/:slug/posts)
//   Job Postings — this company's open roles         (GET /companies/:slug/job-postings)
//
// Each non-default panel mounts only once its tab is first opened, so its
// fetch never fires for a visitor who only ever looks at Ratings. Once
// mounted a panel stays mounted (just hidden), so its scroll position and
// any loaded pages survive a tab switch.
//
// This is entirely separate from the global "IWT Social" and "Jobs" links
// in GlobalHeader — those still point at the site-wide /social and /jobs
// pages and are not touched.

type TabKey = "ratings" | "social" | "jobs";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ratings", label: "Ratings" },
  { key: "social", label: "IWT Social" },
  { key: "jobs", label: "Job Postings" },
];

function isTabKey(value: string | undefined): value is TabKey {
  return value === "ratings" || value === "social" || value === "jobs";
}

export function CompanyProfileTabs({
  slug,
  initialTab,
  ratings,
}: {
  slug: string;
  initialTab?: string;
  ratings: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>(isTabKey(initialTab) ? initialTab : "ratings");
  // Which panels have been shown at least once — gates the mount of the
  // Social/Jobs panels (and therefore their network calls).
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set<TabKey>([active]));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectTab = useCallback((key: TabKey) => {
    setActive(key);
    setVisited((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    // Reflect the tab in the URL without a navigation or scroll jump, so a
    // copied link (e.g. shared with someone weighing a job offer) reopens
    // on the same tab. "ratings" is the default, so it drops the param.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (key === "ratings") url.searchParams.delete("tab");
      else url.searchParams.set("tab", key);
      window.history.replaceState(null, "", url);
    }
  }, []);

  // Left/Right/Home/End move focus between tabs and activate them, per the
  // WAI-ARIA tabs pattern — the whole strip is one tab stop.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = TABS.findIndex((t) => t.key === active);
      let nextIndex: number | null = null;
      if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
      else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      else if (e.key === "Home") nextIndex = 0;
      else if (e.key === "End") nextIndex = TABS.length - 1;
      if (nextIndex === null) return;
      e.preventDefault();
      selectTab(TABS[nextIndex].key);
      tabRefs.current[nextIndex]?.focus();
    },
    [active, selectTab],
  );

  // If the browser Back/Forward button changes ?tab=, follow it.
  useEffect(() => {
    function syncFromUrl() {
      const param = new URL(window.location.href).searchParams.get("tab") ?? undefined;
      const key: TabKey = isTabKey(param) ? param : "ratings";
      setActive(key);
      setVisited((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    }
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const panelId = useMemo(
    () => ({
      ratings: "company-tabpanel-ratings",
      social: "company-tabpanel-social",
      jobs: "company-tabpanel-jobs",
    }),
    [],
  );
  const tabId = useMemo(
    () => ({
      ratings: "company-tab-ratings",
      social: "company-tab-social",
      jobs: "company-tab-jobs",
    }),
    [],
  );

  return (
    <div className="mt-6">
      {/* Big, obvious, equal-width targets — three across at every width so a
          thumb on a phone always lands on a tab. min-h keeps each one well
          past the 44px tap-target floor. Colors are all semantic tokens, so
          the active/inactive treatment is identical in light and dark. */}
      <div
        role="tablist"
        aria-label="Company profile sections"
        onKeyDown={onKeyDown}
        className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-muted p-1"
      >
        {TABS.map((tab, i) => {
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId[tab.key]}
              aria-selected={selected}
              aria-controls={panelId[tab.key]}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              className={`flex min-h-12 items-center justify-center rounded-lg px-3 py-3 text-center text-sm font-semibold transition sm:text-base ${
                selected
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <div
          role="tabpanel"
          id={panelId.ratings}
          aria-labelledby={tabId.ratings}
          hidden={active !== "ratings"}
        >
          {ratings}
        </div>

        <div
          role="tabpanel"
          id={panelId.social}
          aria-labelledby={tabId.social}
          hidden={active !== "social"}
        >
          {visited.has("social") && <SocialFeed scope={{ kind: "company", slug }} />}
        </div>

        <div
          role="tabpanel"
          id={panelId.jobs}
          aria-labelledby={tabId.jobs}
          hidden={active !== "jobs"}
        >
          {visited.has("jobs") && <CompanyJobPostings slug={slug} />}
        </div>
      </div>
    </div>
  );
}
