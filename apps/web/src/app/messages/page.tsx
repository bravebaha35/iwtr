"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { ConversationInbox } from "@/components/messaging/ConversationInbox";

// useSearchParams (the ?c= deep link from a notification) needs a Suspense
// boundary so the page can still prerender.
export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageInner />
    </Suspense>
  );
}

/**
 * The top-bar Messages page. A member sees their own conversations with
 * companies; a company owner sees every conversation across the companies
 * they own (an owner has no personal reviewer inbox).
 */
function MessagesPageInner() {
  const { isAuthenticated, isLoading } = useAuth();
  const isCompanyOwner = useIsCompanyOwner();
  const conversationParam = useSearchParams().get("c");

  if (isLoading) return null;
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in to see your messages.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center px-4 py-8">
      <section className="w-full max-w-6xl rounded-xl border border-border bg-surface p-5 sm:p-6">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Messages</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          {isCompanyOwner
            ? "Private conversations started by reviewers you've publicly replied to. You only see the name and avatar shown on their review, and they see your name. You can't start a conversation yourself, and either side can end one at any time."
            : "Private conversations with companies that replied to your reviews. They only ever see your review name and avatar, never your account."}
        </p>
        <ConversationInbox
          key={`${isCompanyOwner ? "company" : "reviewer"}-${conversationParam ?? "inbox"}`}
          mode={isCompanyOwner ? "company" : "reviewer"}
          initialConversationId={conversationParam}
        />
      </section>
    </div>
  );
}
