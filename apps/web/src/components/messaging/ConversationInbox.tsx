"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConversationSummary, ConversationThread } from "@iwtr/shared-types";
import { apiGet, apiPost } from "@/lib/api-client";
import { ConversationThreadView } from "./ConversationThreadView";

type Props = ({ mode: "reviewer" } | { mode: "company"; companyId: string }) & {
  // Opens this conversation on load (from a notification link's `c` param).
  initialConversationId?: string | null;
};

/**
 * Private reviewer <-> company conversations — the reviewer's "Messages" tab
 * on /me and the owner dashboard's "Messages" category share this one
 * component. Which side the viewer is on is decided by the API, not here.
 */
export function ConversationInbox(props: Props) {
  const listPath = props.mode === "company" ? `/owner/companies/${props.companyId}/conversations` : "/me/conversations";
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(props.initialConversationId ?? null);
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<ConversationSummary[]>(listPath)
      .then((rows) => {
        if (!cancelled) setList(rows);
      })
      .catch(() => {
        if (!cancelled) setListError("Couldn't load your messages.");
      });
    return () => {
      cancelled = true;
    };
  }, [listPath]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    apiGet<ConversationThread>(`/conversations/${selectedId}`)
      .then((loaded) => {
        if (cancelled) return;
        setThreadError(null);
        setThread(loaded);
        // Reading it clears the unread dot and the bell notification.
        void apiPost(`/conversations/${selectedId}/read`, {}).catch(() => undefined);
        setList((rows) => rows?.map((r) => (r.id === selectedId ? { ...r, unread: false } : r)) ?? rows);
      })
      .catch(() => {
        if (!cancelled) setThreadError("Couldn't open that conversation.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const onThreadChange = useCallback((updated: ConversationThread) => {
    setThread(updated);
    setList(
      (rows) =>
        rows?.map((r) =>
          r.id === updated.id
            ? {
                ...r,
                ended: updated.ended,
                endedBy: updated.endedBy,
                lastMessagePreview: updated.lastMessagePreview,
                lastMessageDay: updated.lastMessageDay,
                unread: false,
              }
            : r,
        ) ?? rows,
    );
  }, []);

  if (listError) return <p className="text-sm text-red-700 dark:text-red-300">{listError}</p>;
  if (list === null) return <p className="text-sm text-muted-foreground">Loading messages…</p>;
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {props.mode === "company"
          ? "No messages yet. When a reviewer you've replied to writes to you, it will show up here."
          : "No messages yet. After a company replies to one of your reviews, you can message it privately from My Reviews."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <ul className="flex shrink-0 flex-col gap-2 md:w-64" aria-label="Conversations">
        {list.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setSelectedId(row.id)}
              aria-current={row.id === selectedId ? "true" : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                row.id === selectedId ? "border-border bg-surface-muted" : "border-border bg-surface hover:bg-surface-muted"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-foreground">{row.counterpartName}</span>
                {row.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {row.ended ? "Ended · " : ""}
                {row.lastMessagePreview}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <section className="min-w-0 flex-1 rounded-lg border border-border bg-surface p-4">
        {threadError ? (
          <p className="text-sm text-red-700 dark:text-red-300">{threadError}</p>
        ) : thread && thread.id === selectedId ? (
          <ConversationThreadView thread={thread} mode={props.mode} onChange={onThreadChange} />
        ) : (
          <p className="text-sm text-muted-foreground">{selectedId ? "Loading…" : "Pick a conversation to read it."}</p>
        )}
      </section>
    </div>
  );
}
