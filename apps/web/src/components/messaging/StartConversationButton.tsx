"use client";

import { useState } from "react";
import Link from "next/link";
import type { ConversationThread } from "@iwtr/shared-types";
import { ApiError, apiPost } from "@/lib/api-client";

interface Props {
  reviewId: string;
  companyName: string;
  conversationId: string | null;
}

/**
 * Shown under a company's public reply on My Ratings: lets the review's
 * author open their one private conversation with that company, or jump to
 * it once it exists. The API re-checks every rule (own review, published,
 * has a reply, one conversation per review).
 */
export function StartConversationButton({ reviewId, companyName, conversationId }: Props) {
  const [existingId, setExistingId] = useState(conversationId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingId) {
    return (
      <Link
        href={`/me?tab=messages&c=${existingId}`}
        className="mt-2 inline-block rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted"
      >
        Open conversation
      </Link>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted"
      >
        Message {companyName}
      </button>
    );
  }

  async function send() {
    setError(null);
    setSending(true);
    try {
      const thread = await apiPost<ConversationThread>(`/reviews/${reviewId}/conversation`, { content: draft });
      setExistingId(thread.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Your name and account stay hidden. {companyName} only sees the name shown on your review. You can send one
        message; once they answer, you can keep talking. Either of you can end the conversation at any time.
      </p>
      <label htmlFor={`start-${reviewId}`} className="sr-only">
        Your message to {companyName}
      </label>
      <textarea
        id={`start-${reviewId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Don't include names or contact details."
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
      />
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={send}
          disabled={sending || !draft.trim()}
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
