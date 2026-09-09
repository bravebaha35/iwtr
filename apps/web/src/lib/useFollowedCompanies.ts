"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CompanyFollowToggleResult, FollowedCompanySummary, OwnerTier } from "@iwtr/shared-types";
import { apiGet, apiPost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// Module-level cache + subscriber list (no <Provider> needed) so the
// "Following" sidebar list and every post card's Follow/Following button
// - on both /social and /social/[slug], mounted independently - share one
// fetch and stay in sync the instant either one toggles a follow. Same
// "plain hooks, no data-fetching library" style as useIsCompanyOwner.ts;
// this file just adds the shared-cache part that one didn't need.
let cache: FollowedCompanySummary[] | null = null;
let inFlight: Promise<FollowedCompanySummary[]> | null = null;
const listeners = new Set<() => void>();

function setCache(next: FollowedCompanySummary[]) {
  cache = next;
  listeners.forEach((l) => l());
}

function load(): Promise<FollowedCompanySummary[]> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = apiGet<FollowedCompanySummary[]>("/me/follows/companies")
      .then((list) => {
        cache = list;
        return list;
      })
      .catch(() => {
        cache = [];
        return [];
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

type FollowSummaryInput = { companyName: string; companySlug: string; mainPhotoUrl: string | null; badgeTier: OwnerTier };

export function useFollowedCompanies() {
  const { isAuthenticated, role } = useAuth();
  // Owners cannot act as employee followers (RolesGuard on the API side
  // enforces this for real - this is just the frontend not offering an
  // action that would 403).
  const canFollow = isAuthenticated && role === "MEMBER";
  const [companies, setCompanies] = useState<FollowedCompanySummary[]>(cache ?? []);
  const [loading, setLoading] = useState(() => canFollow && cache === null);

  useEffect(() => {
    const listener = () => setCompanies(cache ?? []);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!canFollow) {
      setCache([]);
      return;
    }
    if (cache) return;
    // Kicking off an async fetch (setLoading(true), then setLoading(false)
    // once it resolves) is the documented exception to this rule, not the
    // "derived value" anti-pattern it targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load().then((list) => {
      setCache(list);
      setLoading(false);
    });
  }, [canFollow]);

  const followedIds = useMemo(() => new Set(companies.map((c) => c.companyId)), [companies]);

  const toggleFollow = useCallback(
    async (companyId: string, summary?: FollowSummaryInput) => {
      if (!canFollow) return;
      const current = cache ?? [];
      const wasFollowing = current.some((c) => c.companyId === companyId);
      const next = wasFollowing
        ? current.filter((c) => c.companyId !== companyId)
        : [
            ...current,
            {
              companyId,
              companyName: summary?.companyName ?? "",
              companySlug: summary?.companySlug ?? "",
              mainPhotoUrl: summary?.mainPhotoUrl ?? null,
              badgeTier: summary?.badgeTier ?? "FREE",
            },
          ];
      setCache(next);
      try {
        await apiPost<CompanyFollowToggleResult>(`/me/follows/companies/${companyId}`, {});
      } catch {
        setCache(current);
      }
    },
    [canFollow],
  );

  return { companies, followedIds, loading, canFollow, toggleFollow };
}
