"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * Blocks a page's real content from a logged-out visitor, showing a Register
 * prompt instead. Used by the homepage and IWT Social — both were public,
 * read-only browsing by earlier design; this is a deliberate later product
 * decision to require an account before either is visible at all.
 */
export function AnonGate({
  title,
  description,
  children,
  assumeAnonymous = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  // Set by a server component that saw no session cookie at all: the visitor
  // is certainly logged out, so the register prompt is rendered right away
  // (server-side, part of the first paint) instead of after the browser's
  // own session check.
  assumeAnonymous?: boolean;
}) {
  const { isLoading, isAuthenticated, openAuthModal } = useAuth();

  if (isLoading && !assumeAnonymous) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        <button
          type="button"
          onClick={() => openAuthModal("register")}
          className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Register
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
