"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationThread } from "@iwtr/shared-types";
import { containsTurkishPhoneNumber, PHONE_SHARING_NOTE, sendMessageInputSchema } from "@iwtr/shared-types";
import { ApiError, apiPost } from "@/lib/api-client";
import { formProblem } from "@/lib/validateForm";
import { ConversationStatus, CounterpartPicture, SidePicture } from "./conversationIdentity";

interface Props {
  thread: ConversationThread;
  mode: "reviewer" | "company";
  onChange: (thread: ConversationThread) => void;
  // "dock": inside a narrow chat panel (IWT Social's message dock), whose
  // own title bar already shows who the conversation is with - so only the
  // review excerpt and End stay up here, and everything is a size smaller.
  variant?: "page" | "dock";
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

// Shown under any message with a phone number in it, and under the message
// box while one is being typed. Numbers are allowed (both sides may agree to
// swap them); this is a reminder, not a block.
function PhoneSharingNote({ className = "" }: { className?: string }) {
  return (
    <p
      role="note"
      className={`flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      {PHONE_SHARING_NOTE}
    </p>
  );
}

/**
 * One private reviewer <-> company conversation. Days only, never times: an
 * exact send time could help a company work out who the reviewer is.
 */
export function ConversationThreadView({ thread, mode, onChange, variant = "page" }: Props) {
  const dock = variant === "dock";
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLOListElement>(null);
  const mySide = mode === "reviewer" ? "REVIEWER" : "COMPANY";
  const theirSide = mode === "reviewer" ? "COMPANY" : "REVIEWER";

  // Newest message in view on open and after every send.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.id, thread.messages.length]);

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
    <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${dock ? "gap-2" : "gap-4"}`}>
      <header
        className={`flex shrink-0 flex-wrap items-start justify-between border-b border-border ${dock ? "gap-2 pb-2" : "gap-3 pb-3"}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          {!dock && <CounterpartPicture conversation={thread} mode={mode} />}
          <div className="min-w-0">
            {!dock && <h3 className="text-base font-semibold text-foreground">{thread.companyName}</h3>}
            {!dock && <ConversationStatus conversation={thread} mode={mode} />}
            {thread.reviewExcerpt && (
              <p className={`line-clamp-2 text-xs italic text-muted-foreground ${dock ? "" : "mt-1"}`}>
                {mode === "company" ? "About their review: " : "About your review: "}
                &ldquo;{thread.reviewExcerpt}&rdquo;
              </p>
            )}
          </div>
        </div>
        {!thread.ended && (
          <button
            type="button"
            onClick={end}
            aria-label="End conversation"
            className={`rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-surface-muted ${dock ? "px-2 py-1" : "px-3 py-1.5"}`}
          >
            {dock ? "End" : "End conversation"}
          </button>
        )}
      </header>

      <ol ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1" aria-label="Messages">
        {groups.map((group) => (
          <li key={group.day} className="flex flex-col gap-2">
            <p className="text-center text-xs font-medium text-muted-foreground">{formatDay(group.day)}</p>
            {group.messages.map((message) => (
              <div key={message.id} className={message.fromMe ? "flex flex-col items-end gap-1" : "flex flex-col items-start gap-1"}>
                <div className={message.fromMe ? "flex flex-row-reverse items-end gap-2" : "flex items-end gap-2"}>
                  <SidePicture conversation={thread} side={message.fromMe ? mySide : theirSide} />
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
                {message.sharesPhoneNumber && <PhoneSharingNote className="mx-10 max-w-[85%]" />}
              </div>
            ))}
          </li>
        ))}
      </ol>

      <div className="flex shrink-0 flex-col gap-2 border-t border-border pt-3">
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
          rows={dock ? 2 : 3}
          placeholder={thread.canSend ? "Write a message. Don't include anyone's name." : ""}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
        />
        {thread.canSend && containsTurkishPhoneNumber(draft) && <PhoneSharingNote />}
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
