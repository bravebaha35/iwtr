"use client";

// B2B corporate pricing comparison — Free/Starter/Pro/Enterprise. All copy
// below is mapped verbatim from the CEO-finalized 4-tier matrix; nothing
// here is invented. Frontend-only: no Prisma/API/billing logic lives here,
// this is purely a display of the plan matrix (the one real purchase flow
// that exists today, Plus checkout, is unrelated and lives on the owner
// dashboard itself).

interface TierValue {
  free: React.ReactNode;
  starter: React.ReactNode;
  pro: React.ReactNode;
  enterprise: React.ReactNode;
}

interface PricingRow {
  label: string;
  values: TierValue;
}

function PriceCell({ price, annualNote }: { price: string; annualNote?: string }) {
  return (
    <div>
      <span className="text-lg font-bold text-foreground">{price}</span>
      {annualNote && <p className="mt-1 text-xs leading-snug text-muted-foreground">{annualNote}</p>}
    </div>
  );
}

const BADGE_STYLES: Record<string, string> = {
  Blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Blue+": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Gold: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

function BadgeCell({ value }: { value: string }) {
  if (value === "No") {
    return <span className="text-muted-foreground">No</span>;
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_STYLES[value] ?? ""}`}>
      {value}
    </span>
  );
}

const ROWS: PricingRow[] = [
  {
    label: "Price",
    values: {
      free: <span className="text-lg font-bold text-foreground">Free</span>,
      starter: (
        <PriceCell price="299,99₺" annualNote="If paid annually, it's only ₺2,999.99 instead of ₺3,599.88!" />
      ),
      pro: <PriceCell price="499,99₺" annualNote="If paid annually, it's only ₺4,999.99 instead of ₺7,199.88!" />,
      enterprise: (
        <PriceCell price="999,99₺" annualNote="If paid annually, it's only ₺9,999.99 instead of ₺11,999.88!" />
      ),
    },
  },
  {
    label: "Target Company Scale",
    values: {
      free: "Micro and Small Businesses",
      starter: "Small and Medium-Sized Enterprises",
      pro: "Medium-Sized Enterprises",
      enterprise: "Holdings and Multinational Corporations and Franchises",
    },
  },
  {
    label: "Verified Employer Badge",
    values: {
      free: <BadgeCell value="No" />,
      starter: <BadgeCell value="Blue" />,
      pro: <BadgeCell value="Blue+" />,
      enterprise: <BadgeCell value="Gold" />,
    },
  },
  {
    label: "Monthly Comment Response Count",
    values: {
      free: "Max. 2 comments",
      starter: "Max. 6 comments",
      pro: "Max. 10 comments",
      enterprise: "Unlimited",
    },
  },
  {
    label: "HR Analytics Dashboard Access",
    values: {
      free: `Only see company's "Questions and Answers", change logo, add contact information.`,
      starter: `See "Questions and Answers", Green Flags & Redflags, add logo, general information, contact information.`,
      pro: `See "Questions and Answers", Green Flags & Redflags, Most "Yes" answered question, Most "No" answered question (both in top 5 form), add logo and banner, general information, contact information.`,
      enterprise: `See "Questions and Answers", Green Flags & Redflags, Most "Yes" answered question, Most "No" answered question (both in top 5 form), suggestions about company below top 5, add logo and banner, general information, contact information.`,
    },
  },
  {
    label: "Industry and Competitor Benchmarking",
    values: {
      free: "No",
      starter: "Only the industry average.",
      pro: "Monthly single competitor comparison, Industry and Competitor Benchmarking",
      enterprise: "Monthly Competitor & Regional Benchmarking Report",
    },
  },
  {
    label: "Posting Featured Job Ads",
    values: {
      free: (
        <span>
          No<sup className="ml-0.5 text-brand-600 dark:text-brand-400">*</sup>
        </span>
      ),
      starter: "2 Ads Monthly",
      pro: "5 Ads Monthly",
      enterprise: "10 Ads Monthly",
    },
  },
  {
    label: "Candidate Tracking & Talent Pool Access",
    values: {
      free: `Only see who applied for them and message them in "Job" section.`,
      starter: `Only see who applied for them and message them in "Job" section.`,
      pro: `Advanced HR Filtering, only see who applied for them and message them in "Job" section.`,
      enterprise: `Advanced HR Filtering, only see who applied for them and message them in "Job" section.`,
    },
  },
  {
    label: "Exporting HR Data (PDF / Excel Report)",
    values: {
      free: "No",
      starter: "No",
      pro: "Monthly Reports",
      enterprise: "Unlimited Reports",
    },
  },
  {
    label: "HR Manager License (User Account)",
    values: {
      free: "Single user",
      starter: "2 users",
      pro: "5 users",
      enterprise: "10 users and sub-users",
    },
  },
  {
    label: "Customer Support & Service Level (SLA)",
    values: {
      free: "Standard mail",
      starter: "Standard mail",
      pro: "Prioritized Mail Support (4 Hours)",
      enterprise: "Prioritized Mail Support (4 Hours) and Chat option",
    },
  },
];

const TIER_HEADERS: { key: keyof TierValue; label: string }[] = [
  { key: "free", label: "Free" },
  { key: "starter", label: "Starter" },
  { key: "pro", label: "Pro" },
  { key: "enterprise", label: "Enterprise" },
];

export function PricingComparisonTable({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="relative flex w-full max-w-6xl flex-col rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">Pricing</h2>
            <p className="mt-1 text-sm text-muted-foreground">Compare what each membership tier includes.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto" style={{ maxHeight: "calc(90vh - 88px)" }}>
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "19.5%" }} />
              <col style={{ width: "19.5%" }} />
              <col style={{ width: "19.5%" }} />
              <col style={{ width: "19.5%" }} />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-10 bg-surface">
                <th className="border-b border-border px-4 py-4 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Feature
                </th>
                {TIER_HEADERS.map((tier) => (
                  <th
                    key={tier.key}
                    className="border-b border-border border-l border-border px-4 py-4 text-left align-bottom text-base font-bold text-foreground"
                  >
                    {tier.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border">
                  <td className="px-4 py-4 align-top text-sm font-semibold text-foreground">{row.label}</td>
                  {TIER_HEADERS.map((tier) => (
                    <td
                      key={tier.key}
                      className="border-l border-border px-4 py-4 align-top text-sm leading-relaxed text-foreground"
                    >
                      {row.values[tier.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="px-6 py-5 text-xs leading-relaxed text-muted-foreground">
            * For &apos;Posting Featured Job Ads&apos; on the Free Membership, companies can get as much as they
            want for an additional separate price.
          </p>
        </div>
      </div>
    </div>
  );
}
