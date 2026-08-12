"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import type { AdminQueueItem } from "@iwtr/shared-types";

const CATEGORY_FIELDS: { score: keyof AdminQueueItem["review"]; label: string }[] = [
  { score: "corporateCultureScore", label: "Corporate Culture" },
  { score: "leadershipScore", label: "Leadership & Management" },
  { score: "infrastructureScore", label: "Infrastructure & Resources" },
  { score: "workLifeBalanceScore", label: "Work-Life Balance" },
  { score: "stabilityScore", label: "Organizational Stability" },
];

export default function ModerationQueuePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [items, setItems] = useState<AdminQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiGet<AdminQueueItem[]>("/admin/moderation-queue?status=OPEN");
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load queue.");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject" | "request-sgk-doc") {
    setActioningId(id);
    setError(null);
    try {
      await apiPost(`/admin/moderation-queue/${id}/${action}`, {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setActioningId(null);
    }
  }

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in as an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Moderation queue</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Reviews the AI flagged as low-confidence or worth a second look before publishing.
      </p>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {items === null && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
      {items !== null && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Queue is empty. Nothing waiting for review.</p>
      )}

      <div className="flex flex-col gap-4 compact:gap-2">
        {items?.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-surface p-5 compact:p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">{item.companyName}</h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {item.reason}
              </span>
            </div>

            <div className="mb-3 flex flex-col gap-1 text-sm compact:text-xs">
              {CATEGORY_FIELDS.map((f) => (
                <div key={f.label} className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {f.label}: {String(item.review[f.score])}/5
                  </span>
                </div>
              ))}
              {item.review.generalThoughts && (
                <div className="mt-1 italic text-muted-foreground">
                  &ldquo;{item.review.generalThoughts}&rdquo;
                </div>
              )}
            </div>

            {item.aiSummary && (
              <p className="mb-3 rounded-md bg-surface-muted p-2 text-xs text-muted-foreground">
                {item.aiSummary}
              </p>
            )}

            <div className="flex gap-2 compact:gap-1.5">
              <button
                onClick={() => act(item.id, "approve")}
                disabled={actioningId === item.id}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve &amp; publish
              </button>
              <button
                onClick={() => act(item.id, "reject")}
                disabled={actioningId === item.id}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => act(item.id, "request-sgk-doc")}
                disabled={actioningId === item.id}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                Request SGK document
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
