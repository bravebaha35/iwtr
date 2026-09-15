"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SavedJobPosting, SavedJobPostingToggleResult } from "@iwtr/shared-types";
import { apiGet, apiPost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// Same module-level cache + subscriber pattern as useFollowedCompanies.ts —
// the bookmark icon on every JobCard and the Jobs page's Saved Posts view
// are mounted independently and must stay in sync the instant either one
// toggles a save.
let cache: SavedJobPosting[] | null = null;
let inFlight: Promise<SavedJobPosting[]> | null = null;
const listeners = new Set<() => void>();

function setCache(next: SavedJobPosting[]) {
  cache = next;
  listeners.forEach((l) => l());
}

function load(): Promise<SavedJobPosting[]> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = apiGet<SavedJobPosting[]>("/me/saved-job-postings")
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

export function useSavedJobPostings() {
  const { isAuthenticated, role } = useAuth();
  // Owners cannot save postings as a job-seeker — RolesGuard 403s this
  // server-side too (@Roles("MEMBER") on SavedJobPostingsController), same
  // reasoning as useFollowedCompanies' canFollow.
  const canSave = isAuthenticated && role === "MEMBER";
  const [postings, setPostings] = useState<SavedJobPosting[]>(cache ?? []);
  const [loading, setLoading] = useState(() => canSave && cache === null);

  useEffect(() => {
    const listener = () => setPostings(cache ?? []);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!canSave) {
      setCache([]);
      return;
    }
    if (cache) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load().then((list) => {
      setCache(list);
      setLoading(false);
    });
  }, [canSave]);

  const savedIds = useMemo(() => new Set(postings.map((p) => p.posting.id)), [postings]);

  const toggleSave = useCallback(
    async (jobPostingId: string) => {
      if (!canSave) return;
      const before = cache ?? [];
      const wasSaved = before.some((p) => p.posting.id === jobPostingId);
      // Optimistic removal only — adding a row back in needs the full
      // {company, posting, expired} shape this call's result doesn't carry
      // (POST only returns {jobPostingId, saved}), so a fresh save
      // invalidates the cache and re-fetches instead of guessing a shape.
      if (wasSaved) {
        setCache(before.filter((p) => p.posting.id !== jobPostingId));
      }
      try {
        const result = await apiPost<SavedJobPostingToggleResult>(`/me/saved-job-postings/${jobPostingId}`, {});
        if (result.saved) {
          cache = null;
          setCache(await load());
        }
      } catch {
        if (wasSaved) setCache(before);
      }
    },
    [canSave],
  );

  return { postings, savedIds, loading, canSave, toggleSave };
}
