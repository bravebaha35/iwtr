"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import type { AdminQueueItem } from "@iwtr/shared-types";

const CATEGORY_FIELDS: { score: keyof AdminQueueItem["review"]; comment: keyof AdminQueueItem["review"]; label: string }[] = [
  { score: "corporateCultureScore", comment: "corporateCultureComment", label: "Corporate Culture" },
  { score: "leadershipScore", comment: "leadershipComment", label: "Leadership & Management" },
  { score: "infrastructureScore", comment: "infrastructureComment", label: "Infrastructure & Resources" },
  { score: "workLifeBalanceScore", comment: "workLifeBalanceComment", label: "Work-Life Balance" },
  { score: "stabilityScore", comment: "stabilityComment", label: "Organizational Stability" },
];

export default function ModerationQueuePage() {
  const { accessToken, isLoading } = useAuth();
  const [items, setItems] = useState<AdminQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiGet<AdminQueueItem[]>("/admin/moderation-queue?status=OPEN", accessToken);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load queue.");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "approve" | "reject" | "request-sgk-doc") {
    setActioningId(id);
    setError(null);
    try {
      await apiPost(`/admin/moderation-queue/${id}/${action}`, {}, accessToken ?? undefined);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setActioningId(null);
    }
  }

  if (isLoading) return null;

  if (!accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-500">Log in as an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Moderation queue
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Reviews the AI flagged as low-confidence or worth a second look before publishing.
      </p>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {items === null && <p className="text-sm text-zinc-500">Loading...</p>}
      {items !== null && items.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Queue is empty. Nothing waiting for review.</p>
      )}

      <div className="flex flex-col gap-4">
        {items?.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{item.companyName}</h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                {item.reason}
              </span>
            </div>

            <div className="mb-3 flex flex-col gap-1 text-sm">
              {CATEGORY_FIELDS.map((f) => (
                <div key={f.label} className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {f.label}: {String(item.review[f.score])}/5
                  </span>
                  {item.review[f.comment] && <span> &mdash; {String(item.review[f.comment])}</span>}
                </div>
              ))}
              {item.review.generalThoughts && (
                <div className="mt-1 italic text-zinc-600 dark:text-zinc-400">
                  &ldquo;{item.review.generalThoughts}&rdquo;
                </div>
              )}
            </div>

            {item.aiSummary && (
              <p className="mb-3 rounded-md bg-zinc-50 p-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {item.aiSummary}
              </p>
            )}

            <div className="flex gap-2">
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
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
