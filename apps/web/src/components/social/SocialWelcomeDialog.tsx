"use client";

import { useEffect, useState } from "react";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";

const SEEN_KEY = "iwtr:social-welcome-seen";

export function SocialWelcomeDialog() {
  const isOwner = useIsCompanyOwner();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* private mode - just don't show it */
    }
  }, [isOwner]);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-medium text-foreground">
          You can share your projects, photos or posts if you like !
        </p>
        {/* 1:1 placeholder box - deliberately empty, for future design
            integration. */}
        <div className="mx-auto mt-4 aspect-square w-full max-w-[240px] rounded-lg border border-dashed border-border" />
        <button
          type="button"
          onClick={dismiss}
          className="mt-4 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
