"use client";

import { useState } from "react";
import type { ConversationThread } from "@iwtr/shared-types";
import { sendMessageInputSchema } from "@iwtr/shared-types";
import { ApiError, apiPost } from "@/lib/api-client";
import { formProblem } from "@/lib/validateForm";

interface Props {
  thread: ConversationThread;
  mode: "reviewer" | "company";
  onChange: (thread: ConversationThread) => void;
}

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One private reviewer <-> company conversation. Days only, never times: an
 * exact send time could help a company work out who the reviewer is.
 */
export function ConversationThreadView({ thread, mode, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabledReason =
    thread.cannotSendReason === "ENDED"
      ? thread.endedBy === "YOU"
        ? "You ended this conversation. No more messages can be sent."
        : "This conversation was ended. No more messages can be sent."
      : thread.cannotSendReason === "AWAITING_COMPANY"
        ? `Please wait for ${thread.companyName} to answer before sending another message.`
        : null;

  async function send() {
    if (!draft.trim()) return;
    const problem = formProblem(sendMessageInputSchema, { content: draft });
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const updated = await apiPost<ConversationThread>(`/conversations/${thread.id}/messages`, { content: draft });
      setDraft("");
      onChange(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function end() {
    if (!window.confirm("End this conversation? Neither side will be able to send messages here again.")) return;
    setError(null);
    try {
      onChange(await apiPost<ConversationThread>(`/conversations/${thread.id}/end`, {}));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't end the conversation. Please try again.");
    }
  }

  // Group consecutive messages under one day label.
  const groups: { day: string; messages: ConversationThread["messages"] }[] = [];
  for (const message of thread.messages) {
    const last = groups[groups.length - 1];
    if (last && last.day === message.day) last.messages.push(message);
    else groups.push({ day: message.day, messages: [message] });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{thread.counterpartName}</h3>
          {thread.reviewExcerpt && (
            <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
              {mode === "company" ? "About their review: " : "About your review: "}
              &ldquo;{thread.reviewExcerpt}&rdquo;
            </p>
          )}
        </div>
        {!thread.ended && (
          <button
            type="button"
            onClick={end}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted"
          >
            End conversation
          </button>
        )}
      </header>

      <ol className="flex flex-col gap-4" aria-label="Messages">
        {groups.map((group) => (
          <li key={group.day} className="flex flex-col gap-2">
            <p className="text-center text-xs font-medium text-muted-foreground">{formatDay(group.day)}</p>
            {group.messages.map((message) => (
              <div key={message.id} className={message.fromMe ? "flex justify-end" : "flex justify-start"}>
                <p
                  className={
                    message.fromMe
                      ? "max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-brand-600 px-3 py-2 text-sm text-white"
                      : "max-w-[85%] whitespace-pre-wrap break-words rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  }
                >
                  {message.content}
                </p>
              </div>
            ))}
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {disabledReason && <p className="text-sm text-muted-foreground">{disabledReason}</p>}
        <label htmlFor={`reply-${thread.id}`} className="sr-only">
          Your message
        </label>
        <textarea
          id={`reply-${thread.id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!thread.canSend || sending}
          maxLength={2000}
          rows={3}
          placeholder={thread.canSend ? "Write a message. Don't include names or contact details." : ""}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
        />
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={send}
            disabled={!thread.canSend || sending || !draft.trim()}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
