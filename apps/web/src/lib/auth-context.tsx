"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { OnboardingStatus, UserRole } from "@iwtr/shared-types";
import { apiGet, ApiError } from "./api-client";

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
  // Resolves to { otpRequired: true } for the one hardcoded ADMIN account
  // instead of completing the session — AuthModal shows a 6-digit code step
  // and calls verifyAdminOtp to actually finish logging in from there.
  login: (email: string, password: string) => Promise<{ otpRequired: boolean }>;
  verifyAdminOtp: (email: string, code: string) => Promise<void>;
  logout: () => void;
  // Which tab of AuthModal is active — lifted up here (rather than kept as
  // AuthModal-local state) so GlobalHeader's "Login/Register" button can open
  // straight to the right tab.
  authMode: "login" | "register";
  setAuthMode: (mode: "login" | "register") => void;
  // AuthModal is mounted once globally (layout.tsx) as a dismissible dialog,
  // not a mandatory full-page gate — the homepage renders the read-only
  // WorkplaceBrowser by default for logged-out visitors (company
  // browsing/detail endpoints are already public on the API), and this flag
  // is how any page opens the login/register dialog on top of it.
  authModalOpen: boolean;
  openAuthModal: (mode?: "login" | "register") => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function postCredentials<T = unknown>(path: string, body: unknown): Promise<T> {
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
  return (await res.json()) as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authModalOpen, setAuthModalOpen] = useState(false);

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
    if (!session.isAuthenticated) {
      setIsAuthenticated(false);
      setRole(null);
      setOnboardingStatus(null);
      return;
    }
    try {
      await loadStatus();
      setIsAuthenticated(true);
      setRole(session.role);
    } catch (err) {
      // /api/session only checks the access-token cookie's signature and
      // expiry, not whether the account it points to still exists — a
      // session that outlives its user (deleted/banned account, or a DB
      // restored to an earlier snapshot) gets a 401/404 here even though
      // isAuthenticated read true above. Only treat *those* as a dead
      // session and sign out — a transient network/5xx blip should retry on
      // next focus, not silently log someone out mid-outage. Either way,
      // this closes the hole where page.tsx sees isAuthenticated=true
      // forever with no onboardingStatus, which reads as an infinite
      // "Loading...".
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        setIsAuthenticated(false);
        setRole(null);
        setOnboardingStatus(null);
        void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      } else {
        setIsAuthenticated(true);
        setRole(session.role);
        setOnboardingStatus(null);
      }
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
      setAuthModalOpen(false);
    },
    [loadSession],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await postCredentials<{ status: "OK" | "OTP_REQUIRED" }>("/api/auth/login", {
        email,
        password,
      });
      if (result.status === "OTP_REQUIRED") {
        return { otpRequired: true };
      }
      await loadSession();
      setAuthModalOpen(false);
      return { otpRequired: false };
    },
    [loadSession],
  );

  const verifyAdminOtp = useCallback(
    async (email: string, code: string) => {
      await postCredentials("/api/auth/verify-admin-otp", { email, code });
      await loadSession();
      setAuthModalOpen(false);
    },
    [loadSession],
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setRole(null);
    setOnboardingStatus(null);
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  }, []);

  const openAuthModal = useCallback((mode?: "login" | "register") => {
    if (mode) setAuthMode(mode);
    setAuthModalOpen(true);
  }, []);
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

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
        verifyAdminOtp,
        logout,
        authMode,
        setAuthMode,
        authModalOpen,
        openAuthModal,
        closeAuthModal,
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
