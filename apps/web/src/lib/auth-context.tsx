"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthTokensResponse, OnboardingStatus } from "@iwtr/shared-types";
import { apiGet, apiPost } from "./api-client";

const STORAGE_KEY = "iwtr_tokens";
// Refresh a bit before the access token's real expiry so requests in flight
// right at the boundary don't get caught by a token that just expired.
const REFRESH_SAFETY_MARGIN_MS = 60 * 1000;

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  accessToken: string | null;
  isLoading: boolean;
  onboardingStatus: OnboardingStatus | null;
  refreshOnboardingStatus: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeExpiryMs(accessToken: string): number | null {
  try {
    const payload = accessToken.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const { exp } = JSON.parse(atob(padded)) as { exp?: number };
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  // Concurrent refresh attempts must share one request: the API treats a
  // second presentation of an already-rotated refresh token as theft and
  // revokes every session for the account, so two accidental simultaneous
  // refresh calls (a proactive timer firing right as another one is in
  // flight) would otherwise log the user out instead of just being wasteful.
  const refreshInFlight = useRef<Promise<StoredTokens | null> | null>(null);

  const loadStatus = useCallback(async (accessToken: string) => {
    const status = await apiGet<OnboardingStatus>("/onboarding/status", accessToken);
    setOnboardingStatus(status);
  }, []);

  const storeTokens = useCallback((next: StoredTokens | null) => {
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setTokens(next);
  }, []);

  const doRefresh = useCallback(
    (refreshToken: string): Promise<StoredTokens | null> => {
      if (refreshInFlight.current) return refreshInFlight.current;

      const attempt = (async () => {
        try {
          const result = await apiPost<AuthTokensResponse>("/auth/refresh", { refreshToken });
          if (!result.refreshToken) return null;
          const next: StoredTokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
          storeTokens(next);
          return next;
        } catch {
          storeTokens(null);
          setOnboardingStatus(null);
          return null;
        } finally {
          refreshInFlight.current = null;
        }
      })();

      refreshInFlight.current = attempt;
      return attempt;
    },
    [storeTokens],
  );

  // On load: if the stored access token is already expired (or close to it —
  // e.g. the laptop was asleep for hours), refresh before trusting it rather
  // than firing a status request that's guaranteed to 401.
  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const parsed: StoredTokens = JSON.parse(raw);

    (async () => {
      const expiryMs = decodeExpiryMs(parsed.accessToken);
      const needsRefresh = expiryMs !== null && expiryMs - REFRESH_SAFETY_MARGIN_MS <= Date.now();
      const active = needsRefresh ? await doRefresh(parsed.refreshToken) : parsed;

      if (cancelled) return;
      if (!active) {
        setIsLoading(false);
        return;
      }
      if (!needsRefresh) setTokens(active);

      try {
        await loadStatus(active.accessToken);
      } catch {
        if (!cancelled) storeTokens(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proactively refresh before the access token actually expires, so a
  // 15-minute session doesn't just die silently mid-use.
  useEffect(() => {
    if (!tokens) return;
    const expiryMs = decodeExpiryMs(tokens.accessToken);
    if (expiryMs === null) return;

    const delay = Math.max(expiryMs - REFRESH_SAFETY_MARGIN_MS - Date.now(), 0);
    const handle = setTimeout(() => {
      void doRefresh(tokens.refreshToken);
    }, delay);
    return () => clearTimeout(handle);
  }, [tokens, doRefresh]);

  const persistTokens = useCallback(
    async (result: AuthTokensResponse) => {
      if (!result.refreshToken) {
        throw new Error("Auth response did not include a refresh token");
      }
      const next: StoredTokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
      storeTokens(next);
      await loadStatus(next.accessToken);
    },
    [storeTokens, loadStatus],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const result = await apiPost<AuthTokensResponse>("/auth/register", { email, password });
      await persistTokens(result);
    },
    [persistTokens],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiPost<AuthTokensResponse>("/auth/login", { email, password });
      await persistTokens(result);
    },
    [persistTokens],
  );

  const logout = useCallback(() => {
    const refreshToken = tokens?.refreshToken;
    storeTokens(null);
    setOnboardingStatus(null);
    if (refreshToken) {
      // Best-effort server-side revocation. The local session is already
      // cleared either way, so a network failure here isn't user-visible —
      // but without this, a stolen refresh token would keep working for up
      // to 30 days after the legitimate user clicked "Log out".
      void apiPost("/auth/logout", { refreshToken }).catch(() => {});
    }
  }, [tokens, storeTokens]);

  const refreshOnboardingStatus = useCallback(async () => {
    if (tokens) await loadStatus(tokens.accessToken);
  }, [tokens, loadStatus]);

  return (
    <AuthContext.Provider
      value={{
        accessToken: tokens?.accessToken ?? null,
        isLoading,
        onboardingStatus,
        refreshOnboardingStatus,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
