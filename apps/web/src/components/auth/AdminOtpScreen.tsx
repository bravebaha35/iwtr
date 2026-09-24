"use client";

import { useState } from "react";
import { OtpInput } from "@/components/auth/OtpInput";

/**
 * Second step of logging in as the ADMIN role — shown after a correct
 * password gets back { otpRequired: true } from AuthContext.login (see
 * AuthService.loginWithEmail). Unlike EmailVerificationScreen's OTP step
 * (a client-side mock — see generateMockOtp), the code here is real: it was
 * generated and hashed server-side (AdminLoginOtpService) and is only ever
 * checked by POST /api/auth/verify-admin-otp.
 */
export function AdminOtpScreen({
  email,
  onVerify,
  onBack,
}: {
  email: string;
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function attemptVerify(candidateCode: string) {
    if (candidateCode.length !== 6) return;
    setError(null);
    setSubmitting(true);
    try {
      await onVerify(candidateCode);
    } catch (err) {
      // The API deliberately returns one generic message for every failure
      // mode (wrong code, expired, too many attempts) via
      // AdminLoginOtpService — surfaced as-is here since none of those are
      // sensitive to reveal to whoever's holding this specific account's
      // password already.
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setCode("");
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
      <h2 className="mb-1 text-xl font-bold text-foreground">Enter your login code</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
      </p>

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
    </div>
  );
}
