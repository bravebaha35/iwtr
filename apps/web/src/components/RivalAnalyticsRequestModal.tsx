"use client";

import { useEffect, useState } from "react";
import type { Company, RivalAnalyticsRequestResult, RivalAnalyticsTier } from "@iwtr/shared-types";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { IyzicoCheckoutEmbed } from "@/components/IyzicoCheckoutEmbed";

const emptyBilling = {
  buyerName: "",
  buyerSurname: "",
  buyerIdentityNumber: "",
  buyerEmail: "",
  buyerGsmNumber: "",
  city: "",
  address: "",
};

export function RivalAnalyticsRequestModal({
  requestingCompanyId,
  rivalAnalyticsTier,
  rivalAnalyticsFreeRequestUsed,
  onClose,
  onFreeCreditUsed,
}: {
  requestingCompanyId: string;
  rivalAnalyticsTier: RivalAnalyticsTier | null;
  rivalAnalyticsFreeRequestUsed: boolean;
  onClose: () => void;
  // The free-credit flag lives on the parent page's claim data, fetched
  // once on load — without this, sending a free report wouldn't update the
  // "1 Free Request available" badge until a manual page reload.
  onFreeCreditUsed?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [target, setTarget] = useState<Company | null>(null);
  const [billing, setBilling] = useState(emptyBilling);
  const [result, setResult] = useState<RivalAnalyticsRequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasFreeRequest = rivalAnalyticsTier === "ENTERPRISE" && !rivalAnalyticsFreeRequestUsed;

  // Own inline search rather than reusing CompanySearch — that component
  // always navigates via <Link> on click; this one needs to select a
  // company into local state instead, without leaving the page.
  useEffect(() => {
    if (target || query.trim().length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      apiGet<Company[]>(`/companies?q=${encodeURIComponent(query)}`)
        .then((data) => {
          if (!cancelled) setResults(data.filter((c) => c.id !== requestingCompanyId));
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, target, requestingCompanyId]);

  function set<K extends keyof typeof emptyBilling>(key: K, value: string) {
    setBilling((b) => ({ ...b, [key]: value }));
  }

  async function submit() {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { requestingCompanyId };
      if (!hasFreeRequest) {
        body.billing = {
          buyerName: billing.buyerName,
          buyerSurname: billing.buyerSurname,
          buyerIdentityNumber: billing.buyerIdentityNumber,
          buyerEmail: billing.buyerEmail,
          buyerGsmNumber: billing.buyerGsmNumber || undefined,
          billingAddress: {
            contactName: `${billing.buyerName} ${billing.buyerSurname}`.trim(),
            city: billing.city,
            country: "Turkey",
            address: billing.address,
          },
        };
      }
      const data = await apiPost<RivalAnalyticsRequestResult>(`/companies/${target.slug}/rival-analytics/request`, body);
      setResult(data);
      if (data.status === "SENT" && data.usedFreeCredit) {
        onFreeCreditUsed?.();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't request this report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-lg rounded-xl bg-surface p-8 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl dark:bg-brand-900">
          📊
        </div>
        <h2 className="mb-2 text-center text-xl font-bold text-foreground">Rival Analytics</h2>
        <p className="mb-6 text-center text-sm leading-6 text-muted-foreground">
          A PDF report on another company&apos;s overall rating, most agreed/disputed questions, and workplace vibe
          flags — aggregated and anonymized, individual comments never included — emailed straight to you.
        </p>

        {result ? (
          <RivalAnalyticsResult result={result} onClose={onClose} />
        ) : (
          <>
            {!target ? (
              <div className="relative">
                <label className="text-xs font-medium text-muted-foreground">Which company?</label>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a workplace..."
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
                {results.length > 0 && (
                  <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
                    {results.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setTarget(c);
                          setQuery("");
                          setResults([]);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface-muted"
                      >
                        {c.name}
                        <span className="ml-2 text-xs text-muted-foreground">{c.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Reporting on</p>
                  <p className="text-sm font-semibold text-foreground">{target.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  Change
                </button>
              </div>
            )}

            {target && (
              <>
                {hasFreeRequest ? (
                  <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                    <span className="font-semibold">1 Free Request</span> — your Enterprise plan includes one report
                    at no charge. This will use it.
                  </div>
                ) : (
                  <>
                    <div className="mb-4 rounded-lg border border-border p-3 text-sm text-muted-foreground">
                      {rivalAnalyticsTier === "ENTERPRISE"
                        ? "You've already used your free Enterprise report — this one is billed per request."
                        : "Starter and Pro members pay a per-report fee for each Rival Analytics report."}{" "}
                      Enter billing details below to continue to payment.
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="First name"
                        value={billing.buyerName}
                        onChange={(e) => set("buyerName", e.target.value)}
                        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                      />
                      <input
                        placeholder="Last name"
                        value={billing.buyerSurname}
                        onChange={(e) => set("buyerSurname", e.target.value)}
                        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                      />
                      <input
                        placeholder="T.C. Kimlik No / Tax ID (11 digits)"
                        value={billing.buyerIdentityNumber}
                        onChange={(e) => set("buyerIdentityNumber", e.target.value)}
                        className="col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                      />
                      <input
                        placeholder="Billing email"
                        value={billing.buyerEmail}
                        onChange={(e) => set("buyerEmail", e.target.value)}
                        className="col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                      />
                      <input
                        placeholder="Phone (optional)"
                        value={billing.buyerGsmNumber}
                        onChange={(e) => set("buyerGsmNumber", e.target.value)}
                        className="col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                      />
                      <input
                        placeholder="City"
                        value={billing.city}
                        onChange={(e) => set("city", e.target.value)}
                        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                      />
                      <input
                        placeholder="Billing address"
                        value={billing.address}
                        onChange={(e) => set("address", e.target.value)}
                        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                      />
                    </div>
                  </>
                )}

                {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className={`mt-4 w-full rounded-lg py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
                    hasFreeRequest ? "bg-green-600 hover:bg-green-700" : "bg-brand-600 hover:bg-brand-700"
                  }`}
                >
                  {submitting ? "Please wait..." : hasFreeRequest ? "Send my free report" : "Continue to payment"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RivalAnalyticsResult({ result, onClose }: { result: RivalAnalyticsRequestResult; onClose: () => void }) {
  if (result.status === "SENT") {
    return (
      <div className="text-center">
        <p className="text-sm text-foreground">
          Report sent to <span className="font-semibold">{result.recipientEmail}</span>.
          {result.usedFreeCredit && " Your free Enterprise request has now been used."}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Done
        </button>
      </div>
    );
  }

  if (result.status === "CHECKOUT_REQUIRED") {
    return (
      <div>
        <p className="mb-2 text-xs text-muted-foreground">
          Complete payment below — your report is generated and emailed automatically once payment succeeds.
        </p>
        <IyzicoCheckoutEmbed checkoutFormContent={result.checkoutFormContent} />
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-sm text-red-600 dark:text-red-400">{result.priceNote}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
      >
        Close
      </button>
    </div>
  );
}
