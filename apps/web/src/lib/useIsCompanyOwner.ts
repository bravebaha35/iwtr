"use client";

import { useAuth } from "@/lib/auth-context";

// The "is this an active, approved employer account" check — previously
// copy-pasted in GlobalHeader.tsx and JobsBrowser.tsx (and needed in the
// social components too). One definition now.
export function useIsCompanyOwner(): boolean {
  const { isAuthenticated, role, onboardingStatus } = useAuth();
  return isAuthenticated && onboardingStatus?.status === "ACTIVE" && role === "COMPANY_OWNER";
}
