"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthTokensResponse, OnboardingStatus } from "@iwtr/shared-types";
import { apiGet, apiPost } from "./api-client";

const STORAGE_KEY = "iwtr_tokens";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);

  const loadStatus = useCallback(async (accessToken: string) => {
    const status = await apiGet<OnboardingStatus>("/onboarding/status", accessToken);
    setOnboardingStatus(status);
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: StoredTokens = JSON.parse(raw);
      setTokens(parsed);
      loadStatus(parsed.accessToken)
        .catch(() => {
          window.localStorage.removeItem(STORAGE_KEY);
          setTokens(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [loadStatus]);

  const persistTokens = useCallback(async (result: AuthTokensResponse) => {
    if (!result.refreshToken) return;
    const next: StoredTokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setTokens(next);
    await loadStatus(next.accessToken);
  }, [loadStatus]);

  const register = useCallback(async (email: string, password: string) => {
    const result = await apiPost<AuthTokensResponse>("/auth/register", { email, password });
    await persistTokens(result);
  }, [persistTokens]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiPost<AuthTokensResponse>("/auth/login", { email, password });
    await persistTokens(result);
  }, [persistTokens]);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setTokens(null);
    setOnboardingStatus(null);
  }, []);

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
