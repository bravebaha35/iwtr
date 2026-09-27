"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConversationSummary, ConversationThread } from "@iwtr/shared-types";
import { apiGet, apiPost } from "@/lib/api-client";
import { ConversationThreadView } from "./ConversationThreadView";
import { ConversationStatus, CounterpartPicture } from "./conversationIdentity";

type Props = {
  // Which side the viewer is on: a reviewer's own inbox, or an owner's inbox
  // across every company they own. The API re-checks this on every call.
  mode: "reviewer" | "company";
  // Opens this conversation on load (from a notification link's `c` param).
  initialConversationId?: string | null;
};

/**
 * Private reviewer <-> company conversations, shown on the top-bar Messages
 * page (/messages) for both sides. A fixed-height panel: the conversation
 * list on the left, the open conversation on the right, each scrolling on
 * its own. On phones only one of the two shows at a time.
 */
export function ConversationInbox(props: Props) {
  const listPath = props.mode === "company" ? "/owner/conversations" : "/me/conversations";
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
                ownerName: updated.ownerName,
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
          : "No messages yet. After a company replies to one of your reviews, you can message it privately from My Ratings."}
      </p>
    );
  }

  return (
    <div className="flex h-[min(44rem,calc(100dvh-14rem))] min-h-[26rem] gap-4">
      <ul
        className={`${selectedId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col gap-2 overflow-y-auto pr-1 md:w-80`}
        aria-label="Conversations"
      >
        {list.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setSelectedId(row.id)}
              aria-current={row.id === selectedId ? "true" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                row.id === selectedId ? "border-border bg-surface-muted" : "border-border bg-surface hover:bg-surface-muted"
              }`}
            >
              <CounterpartPicture conversation={row} mode={props.mode} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-foreground">{row.companyName}</span>
                  {row.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                </span>
                <ConversationStatus conversation={row} mode={props.mode} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <section
        className={`${selectedId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col rounded-lg border border-border bg-surface p-4`}
      >
        {selectedId && (
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="mb-3 self-start text-sm font-medium text-muted-foreground hover:text-foreground md:hidden"
          >
            ← All conversations
          </button>
        )}
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
