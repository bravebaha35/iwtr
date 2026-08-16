"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { Logo } from "@/components/Logo";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { EmailVerificationScreen } from "@/components/auth/EmailVerificationScreen";
import { PASSWORD_MAX_LENGTH, isPasswordValid } from "@/lib/passwordValidation";
import {
  clearPendingVerification,
  loadPendingVerification,
  savePendingVerification,
  validateRegistrationEmail,
} from "@/lib/emailVerification";

export function AuthModal() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState(() => loadPendingVerification()?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A pending verification found on mount means a previous submit already
  // moved past the form step — most likely the page was refreshed while
  // "Verify your email" was showing. Password is never persisted (see
  // lib/emailVerification.ts), so EmailVerificationScreen re-asks for it.
  const [step, setStep] = useState<"form" | "verify">(() => (loadPendingVerification() ? "verify" : "form"));

  function switchMode(next: "login" | "register") {
    setMode(next);
    // Don't carry a password typed under one mode's rules into the other —
    // a login password may be shorter/older than the register requirements,
    // and there's no reason a register draft should linger after switching
    // to log in instead.
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmitRegister = isPasswordValid(password) && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "login") {
      setSubmitting(true);
      try {
        await login(email, password);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Register mode doesn't call the API yet — it hands off to the email
    // verification screen first, and only creates the account once that
    // resolves (see handleVerified below).
    const emailProblem = validateRegistrationEmail(email);
    if (emailProblem) {
      setEmailError(emailProblem);
      return;
    }
    setEmailError(null);
    savePendingVerification({ email, sentAt: Date.now() });
    setStep("verify");
  }

  async function handleVerified(effectivePassword: string) {
    await register(email, effectivePassword);
    clearPendingVerification();
  }

  function handleBackFromVerify() {
    clearPendingVerification();
    setStep("form");
  }

  if (step === "verify") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-xl">
          <EmailVerificationScreen
            email={email}
            password={password}
            onVerified={handleVerified}
            onBack={handleBackFromVerify}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-xl">
        <div className="mb-1 flex items-center justify-center gap-2">
          <Logo />
          <h2 className="text-center text-2xl font-bold text-foreground">
            I Worked There
          </h2>
        </div>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Anonymous, honest workplace reviews.
        </p>

        <div className="mb-6 flex rounded-lg bg-surface-muted p-1">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "register" ? "bg-surface text-brand-700 shadow dark:text-brand-400" : "text-muted-foreground"
            }`}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === "login" ? "bg-surface text-brand-700 shadow dark:text-brand-400" : "text-muted-foreground"
            }`}
            onClick={() => switchMode("login")}
          >
            Log in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              onBlur={() => {
                if (mode === "register" && email) setEmailError(validateRegistrationEmail(email));
              }}
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
            />
            {mode === "register" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Gmail, Hotmail, Outlook, or Windows Live only for now.
              </p>
            )}
            {emailError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{emailError}</p>}
          </div>

          {mode === "register" ? (
            <>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="Password"
                autoComplete="new-password"
                maxLength={PASSWORD_MAX_LENGTH}
              />

              {password.length > 0 && <PasswordChecklist password={password} />}

              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm password"
                autoComplete="new-password"
                maxLength={PASSWORD_MAX_LENGTH}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="-mt-1 text-xs text-red-600 dark:text-red-400">Passwords don&apos;t match.</p>
              )}
            </>
          ) : (
            <PasswordInput value={password} onChange={setPassword} placeholder="Password" autoComplete="current-password" />
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || (mode === "register" && !canSubmitRegister)}
            className="mt-2 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? "Please wait..." : mode === "register" ? "Create account" : "Log in"}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg border border-border py-2 text-sm text-muted-foreground"
          >
            Continue with Google (coming soon)
          </button>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg border border-border py-2 text-sm text-muted-foreground"
          >
            Continue with Apple (coming soon)
          </button>
        </div>
      </div>
    </div>
  );
}
