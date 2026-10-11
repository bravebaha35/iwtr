"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ChatDock } from "./ChatDock";

// Where the Messages dock stays out of the way: Edit Profile (/me itself,
// not My Ratings under it), the company Dashboard, and the admin back office.
function isDockHidden(pathname: string): boolean {
  return pathname === "/me" || pathname.startsWith("/my/companies") || pathname.startsWith("/admin");
}

/**
 * The private-messages dock for the whole site, mounted once in layout.tsx:
 * Home, Jobs, IWT Social, company pages and so on all show it, for a
 * signed-in member or owner with an active account. A company login isn't
 * handled here - its only page is the Dashboard, which mounts its own dock.
 */
export function GlobalChatDock() {
  const pathname = usePathname();
  const { isAuthenticated, onboardingStatus, companyAccount } = useAuth();
  if (!isAuthenticated || onboardingStatus?.status !== "ACTIVE" || companyAccount) return null;
  if (isDockHidden(pathname)) return null;
  return <ChatDock />;
}
