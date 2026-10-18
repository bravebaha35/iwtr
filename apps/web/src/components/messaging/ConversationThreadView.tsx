"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationThread } from "@iwtr/shared-types";
import { containsTurkishPhoneNumber, PHONE_SHARING_NOTE, sendMessageInputSchema } from "@iwtr/shared-types";
import { ApiError, apiPost } from "@/lib/api-client";
import { formProblem } from "@/lib/validateForm";
import { ConversationStatus, CounterpartPicture, SidePicture } from "./conversationIdentity";
import { useI18n, useT } from "@/lib/i18n/client";
import { intlLocale, type Locale } from "@/lib/i18n/core";

interface Props {
  thread: ConversationThread;
  mode: "reviewer" | "company";
  onChange: (thread: ConversationThread) => void;
  // "dock": inside a chat panel, whose own title bar already shows who the
  // conversation is with - so only the review excerpt and End stay up here.
  variant?: "page" | "dock";
  // An enlarged dock panel: bigger type and wider bubbles.
  roomy?: boolean;
}

function formatDay(day: string, locale: Locale): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(intlLocale(locale), {
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
  const t = useT();
  return (
    <p
      role="note"
      className={`flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      {t(PHONE_SHARING_NOTE)}
    </p>
  );
}

/**
 * One private reviewer <-> company conversation. Days only, never times: an
 * exact send time could help a company work out who the reviewer is.
 */
export function ConversationThreadView({ thread, mode, onChange, variant = "page", roomy = false }: Props) {
  const dock = variant === "dock";
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, locale } = useI18n();
  const scrollRef = useRef<HTMLOListElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const mySide = mode === "reviewer" ? "REVIEWER" : "COMPANY";
  const theirSide = mode === "reviewer" ? "COMPANY" : "REVIEWER";
  const text = roomy || !dock ? "text-[15px]" : "text-sm";

  // Newest message in view on open and after every send.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.id, thread.messages.length, roomy]);

  // The message box grows with what's typed, up to a few lines.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, roomy ? 200 : 140)}px`;
  }, [draft, roomy]);

  const disabledReason =
    thread.cannotSendReason === "ENDED"
      ? thread.endedBy === "YOU"
        ? t("You ended this conversation. No more messages can be sent.")
        : t("This conversation was ended. No more messages can be sent.")
      : thread.cannotSendReason === "AWAITING_COMPANY"
        ? t("Please wait for {name} to answer before sending another message.", { name: thread.companyName })
        : null;

  async function send() {
    if (!draft.trim() || sending) return;
    const problem = formProblem(sendMessageInputSchema, { content: draft }, {}, t);
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
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't send that message. Please try again."));
    } finally {
      setSending(false);
    }
  }

  async function end() {
    if (!window.confirm(t("End this conversation? Neither side will be able to send messages here again."))) return;
    setError(null);
    try {
      onChange(await apiPost<ConversationThread>(`/conversations/${thread.id}/end`, {}));
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't end the conversation. Please try again."));
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {!dock && <CounterpartPicture conversation={thread} mode={mode} />}
          <div className="min-w-0">
            {!dock && <h3 className="text-base font-semibold text-foreground">{thread.companyName}</h3>}
            {!dock && <ConversationStatus conversation={thread} mode={mode} />}
            {thread.reviewExcerpt && (
              <p
                className={`border-l-2 border-brand-600/60 pl-2.5 text-xs text-muted-foreground ${roomy ? "" : "line-clamp-2"} ${dock ? "" : "mt-1.5"}`}
              >
                <span className="font-semibold text-foreground/80">
                  {mode === "company" ? t("About their review:") : t("About your review:")}
                </span>{" "}
                <span className="italic">&ldquo;{thread.reviewExcerpt}&rdquo;</span>
              </p>
            )}
          </div>
        </div>
        {!thread.ended && (
          <button
            type="button"
            onClick={end}
            aria-label={t("End conversation")}
            title={t("End conversation")}
            className="shrink-0 rounded-lg bg-surface-muted px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-red-600 hover:text-white"
          >
            {dock && !roomy ? t("End") : t("End conversation")}
          </button>
        )}
      </header>

      <ol ref={scrollRef} className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 pb-1" aria-label={t("Messages")}>
        {groups.map((group) => (
          <li key={group.day} className="flex flex-col gap-1.5">
            <p className="mb-1 self-center rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {formatDay(group.day, locale)}
            </p>
            {group.messages.map((message, i) => {
              const next = group.messages[i + 1];
              // The picture sits beside the last message of a run from one side.
              const lastOfRun = !next || next.fromMe !== message.fromMe;
              return (
                <div key={message.id} className={message.fromMe ? "flex flex-col items-end gap-1" : "flex flex-col items-start gap-1"}>
                  <div className={message.fromMe ? "flex w-full flex-row-reverse items-end gap-2" : "flex w-full items-end gap-2"}>
                    <span className={`shrink-0 ${lastOfRun ? "" : "invisible"}`} aria-hidden={!lastOfRun}>
                      <SidePicture conversation={thread} side={message.fromMe ? mySide : theirSide} />
                    </span>
                    <p
                      className={`${roomy ? "max-w-[75%]" : "max-w-[82%]"} whitespace-pre-wrap break-words px-3.5 py-2 leading-snug ${text} ${
                        message.fromMe
                          ? `rounded-2xl bg-brand-600 text-white ${lastOfRun ? "rounded-br-md" : ""}`
                          : `rounded-2xl bg-surface-muted text-foreground ${lastOfRun ? "rounded-bl-md" : ""}`
                      }`}
                    >
                      {message.content}
                    </p>
                  </div>
                  {message.sharesPhoneNumber && <PhoneSharingNote className="mx-10 max-w-[85%]" />}
                </div>
              );
            })}
          </li>
        ))}
      </ol>

      <div className="flex shrink-0 flex-col gap-2">
        {disabledReason && (
          <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground">{disabledReason}</p>
        )}
        {thread.canSend && containsTurkishPhoneNumber(draft) && <PhoneSharingNote />}
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl bg-surface-muted/70 p-1.5 ring-1 ring-border/70 transition focus-within:ring-2 focus-within:ring-brand-600/60">
          <label htmlFor={`reply-${thread.id}`} className="sr-only">
            {t("Your message")}
          </label>
          <textarea
            id={`reply-${thread.id}`}
            ref={boxRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter starts a new line.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={!thread.canSend || sending}
            maxLength={2000}
            rows={1}
            placeholder={thread.canSend ? t("Write a message. Don't include anyone's name.") : ""}
            className={`min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 ${text}`}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!thread.canSend || sending || !draft.trim()}
            aria-label={t("Send")}
            title={t("Send")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 active:scale-95 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        {thread.canSend && (
          <p className="px-1 text-[11px] text-muted-foreground">{t("Enter to send, Shift + Enter for a new line")}</p>
        )}
      </div>
    </div>
  );
}
