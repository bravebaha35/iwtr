"use client";

import { useEffect, useState } from "react";
import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { generateMockOtp, isDevBypassCode } from "@/lib/emailVerification";

const RESEND_COOLDOWN_SECONDS = 60;

export function EmailVerificationScreen({
  email,
  password,
  onVerified,
  onBack,
}: {
  email: string;
  // Empty after a page refresh — see AuthModal's pending-verification
  // restore. The password is never persisted to any Storage API, so a
  // refresh loses it from memory and this screen asks for it again rather
  // than pretending it still has it.
  password: string;
  onVerified: (password: string) => Promise<void>;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  // "" is just the pre-hydration placeholder — generating the code with
  // Math.random() inside a lazy useState initializer would run once on the
  // server and again on the client's first render, producing two different
  // codes and a hydration mismatch on the dev-only display below. Generated
  // for real in the mount effect instead, client-side only.
  const [expectedCode, setExpectedCode] = useState("");
  const [recoveredPassword, setRecoveredPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    setExpectedCode(generateMockOtp());
    // Intentionally runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function resend() {
    if (cooldown > 0) return;
    setExpectedCode(generateMockOtp());
    setCode("");
    setError(null);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function attemptVerify(candidateCode: string) {
    const effectivePassword = password || recoveredPassword;
    if (!effectivePassword) {
      setError("Please re-enter your password to finish creating your account.");
      return;
    }
    if (candidateCode !== expectedCode && !isDevBypassCode(candidateCode)) {
      setError("That code doesn't match — check the digits and try again.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onVerified(effectivePassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCodeChange(next: string) {
    setCode(next);
    setError(null);
    if (next.length === 6) void attemptVerify(next);
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-xs text-muted-foreground hover:underline">
        &larr; Back
      </button>
      <h2 className="mb-1 text-xl font-bold text-foreground">Verify your email</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
      </p>

      {!password && (
        <div className="mb-4">
          <p className="mb-1 text-xs text-muted-foreground">
            Your session refreshed, so please confirm your password once more to finish.
          </p>
          <PasswordInput
            value={recoveredPassword}
            onChange={setRecoveredPassword}
            placeholder="Password"
            autoComplete="new-password"
          />
        </div>
      )}

      <OtpInput value={code} onChange={handleCodeChange} autoFocus />

      {error && <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        onClick={() => void attemptVerify(code)}
        disabled={submitting || code.length !== 6}
        className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Verifying..." : "Verify"}
      </button>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="mt-3 w-full text-center text-xs text-muted-foreground underline disabled:no-underline disabled:opacity-50"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>

      {/* Dead-code-eliminated out of production builds — see
          isDevBypassCode's doc comment in lib/emailVerification.ts. */}
      {process.env.NODE_ENV === "development" && (
        <>
          <button
            type="button"
            onClick={() => void attemptVerify("999999")}
            className="mt-3 w-full rounded-lg border border-dashed border-brand-300 py-1.5 text-xs font-medium text-brand-700 dark:border-brand-700 dark:text-brand-300"
          >
            Bypass verification (dev only)
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Dev mode code: <span className="font-mono">{expectedCode}</span>
          </p>
        </>
      )}
    </div>
  );
}
