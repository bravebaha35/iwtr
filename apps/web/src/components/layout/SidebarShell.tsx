import type { ReactNode } from "react";

// Locked geometry, extracted verbatim from the Homepage's WorkplaceBrowser
// aside (the project's geometric source of truth) — no className/width/gap
// prop on purpose, so no call site can silently drift this again the way
// SocialSidebar's gap-5 did.
export function SidebarShell({ children }: { children: ReactNode }) {
  return <aside className="flex shrink-0 flex-col gap-6 sm:w-56">{children}</aside>;
}

export function SidebarContentRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6 sm:flex-row">{children}</div>;
}
