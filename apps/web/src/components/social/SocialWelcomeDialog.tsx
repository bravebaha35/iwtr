"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
        className="w-full max-w-md rounded-2xl bg-surface p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-medium text-foreground">
          You can share your projects, photos or posts if you like !
        </p>
        {/* The site beavers at work - the same artwork as the logged-out hero. */}
        <Image
          src="/IWT%20Intro%20Real.png"
          alt=""
          width={1264}
          height={848}
          sizes="320px"
          className="mx-auto mt-4 h-auto w-full max-w-xs"
        />
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
