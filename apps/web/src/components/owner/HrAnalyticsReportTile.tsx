"use client";

import { useState } from "react";

/**
 * HR Analytics Report — placeholder, waiting on the product owner's spec
 * (2026-09-27: "wait for my mark and I will create a feature for it").
 *
 * Ready to wire up: when the feature exists, replace `generate` with the real
 * API call (mirror SectorBenchmarkTile: POST to queue a job, poll, list the
 * finished PDFs) and drop the "coming soon" notice. The tile's place in the
 * dashboard (Premium Features › Benchmark Reports) and its button are final.
 */
export function HrAnalyticsReportTile() {
  const [notice, setNotice] = useState(false);

  function generate() {
    setNotice(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        A report on your own company&apos;s people: what your reviewers praise and criticise most, how that is changing
        over time, and where staff are most likely to leave - as a PDF you can share with your team.
      </p>
      {notice && (
        <p role="status" className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
          The HR Analytics Report is coming soon. We&apos;ll let you know as soon as you can generate it.
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={generate}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Generate Report
        </button>
      </div>
    </div>
  );
}
