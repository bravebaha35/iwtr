"use client";

import { useEffect, useState } from "react";
import { OtpInput } from "@/components/auth/OtpInput";
import { generateMockOtp, isDevBypassCode } from "@/lib/emailVerification";

const RESEND_COOLDOWN_SECONDS = 60;

// Reuses the same mock-OTP building blocks as the registration flow
// (lib/emailVerification.ts, components/auth/OtpInput.tsx) to gate a
// sensitive account action behind a confirmation step — but lighter than
// EmailVerificationScreen, which is register-specific (it re-asks for a
// password lost to a refresh, which has no equivalent here since the visitor
// is already authenticated). Same caveat applies: this is a UI-only
// confirmation, not a real server-verified proof — see lib/emailVerification.ts.
export function EmailConfirmGate({
  email,
  actionLabel,
  onConfirmed,
  onCancel,
}: {
  email: string;
  actionLabel: string;
  onConfirmed: () => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  // "" is just the pre-hydration placeholder — see the matching comment in
  // EmailVerificationScreen.tsx for why this can't be a Math.random() lazy
  // initializer.
  const [expectedCode, setExpectedCode] = useState("");
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

  async function attemptConfirm(candidateCode: string) {
    if (candidateCode !== expectedCode && !isDevBypassCode(candidateCode)) {
      setError("That code doesn't match — check the digits and try again.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  function handleCodeChange(next: string) {
    setCode(next);
    setError(null);
    if (next.length === 6) void attemptConfirm(next);
  }

  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-foreground">Confirm it&apos;s you</p>
      <p className="mb-4 text-xs text-muted-foreground">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span> to confirm you want
        to {actionLabel}.
      </p>

      <OtpInput value={code} onChange={handleCodeChange} autoFocus />

      {error && <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
      {submitting && <p className="mt-3 text-center text-xs text-muted-foreground">Processing...</p>}

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:underline">
          Cancel
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="text-xs text-muted-foreground underline disabled:no-underline disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>

      {/* Dead-code-eliminated out of production builds — see
          isDevBypassCode's doc comment in lib/emailVerification.ts. */}
      {process.env.NODE_ENV === "development" && (
        <>
          <button
            type="button"
            onClick={() => void attemptConfirm("999999")}
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
