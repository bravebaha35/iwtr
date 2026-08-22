"use client";

import Link from "next/link";

// Placeholder pricing table — 5 columns x 12 rows, empty for now. Content
// (plan names, features, prices) gets filled in later; this just reserves
// the grid shape "See plans" on the owner dashboard links to.
const ROWS = 12;
const COLUMNS = 5;

export default function PlansPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <Link href="/my/companies" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
        &larr; Back to my companies
      </Link>
      <h1 className="mb-1 mt-3 text-2xl font-bold text-foreground">Plans</h1>
      <p className="mb-6 text-sm text-muted-foreground">Coming soon.</p>

      <div
        className="grid gap-px overflow-hidden rounded-xl border border-border bg-border"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: ROWS * COLUMNS }).map((_, i) => (
          <div key={i} className="min-h-16 bg-surface" />
        ))}
      </div>
    </div>
  );
}
