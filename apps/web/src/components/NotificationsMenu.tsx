"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Notification } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

function describe(n: Notification): string {
  switch (n.type) {
    case "VOTE_HELPFUL":
      return `Someone found your review at ${n.companyName} helpful.`;
    case "VOTE_NOT_HELPFUL":
      return `Someone marked your review at ${n.companyName} not helpful.`;
    case "COMPANY_REPLY":
      return `${n.companyName} replied to your review.`;
  }
}

/**
 * Header bell — fetches GET /me/notifications on first open (not eagerly on
 * mount, since most page loads never open it) and caches the result for the
 * rest of this mount. No read/unread state yet, just the most recent
 * activity on the caller's own reviews (see NotificationsService.list).
 */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || notifications !== null) return;
    apiGet<Notification[]>("/me/notifications")
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [open, notifications]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        title="Notifications"
        className="flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
      >
        <span className="flex h-8 w-8 items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        <span className="text-[11px] font-medium leading-none">Notifications</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-surface p-2 shadow-xl">
          {notifications === null ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Nothing yet — activity on your reviews will show up here.
            </p>
          ) : (
            <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.companySlug ? `/companies/${n.companySlug}` : "#"}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted"
                  >
                    {describe(n)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
