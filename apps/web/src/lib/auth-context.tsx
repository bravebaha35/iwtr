"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { OnboardingStatus, UserRole } from "@iwtr/shared-types";
import { apiGet } from "./api-client";

interface SessionResponse {
  isAuthenticated: boolean;
  role: UserRole | null;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  role: UserRole | null;
  isLoading: boolean;
  onboardingStatus: OnboardingStatus | null;
  refreshOnboardingStatus: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function postCredentials(path: string, body: unknown): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string };
      if (typeof data.message === "string") message = data.message;
    } catch {
      // no JSON body to read a message from
    }
    throw new Error(message);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);

  const loadStatus = useCallback(async () => {
    const status = await apiGet<OnboardingStatus>("/onboarding/status");
    setOnboardingStatus(status);
  }, []);

  // The single source of truth for "am I logged in" — the /api/session route
  // decodes the httpOnly access-token cookie server-side (transparently
  // refreshing it if needed) since browser JS can no longer read it directly.
  const loadSession = useCallback(async () => {
    const res = await fetch("/api/session", { cache: "no-store" });
    const session = (await res.json()) as SessionResponse;
    setIsAuthenticated(session.isAuthenticated);
    setRole(session.role);
    if (session.isAuthenticated) {
      try {
        await loadStatus();
      } catch {
        setOnboardingStatus(null);
      }
    } else {
      setOnboardingStatus(null);
    }
  }, [loadStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadSession();
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cookies (unlike the old localStorage tokens) are already shared live
  // across tabs by the browser, but this tab's React state isn't — e.g.
  // logging out in another tab wouldn't otherwise update this one until a
  // reload. Resyncing on focus covers the case that actually matters.
  useEffect(() => {
    function onFocus() {
      void loadSession();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadSession]);

  const register = useCallback(
    async (email: string, password: string) => {
      await postCredentials("/api/auth/register", { email, password });
      await loadSession();
    },
    [loadSession],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      await postCredentials("/api/auth/login", { email, password });
      await loadSession();
    },
    [loadSession],
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setRole(null);
    setOnboardingStatus(null);
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  }, []);

  const refreshOnboardingStatus = useCallback(async () => {
    if (isAuthenticated) await loadStatus();
  }, [isAuthenticated, loadStatus]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        role,
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
