"use client";

import { useEffect, useState } from "react";
import { apiPost, ApiError } from "@/lib/api-client";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";

const RESEND_COOLDOWN_SECONDS = 60;

export function PhoneVerificationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("+90");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Only ever set when the API is running outside production with no real
  // SMS provider configured — see PhoneVerificationService.requestOtp.
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function sendCode() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiPost<{ success: boolean; devCode?: string }>("/onboarding/phone/request-otp", {
        phoneNumber,
      });
      setDevCode(result.devCode ?? null);
      setStage("otp");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestCode(e: React.FormEvent) {
    e.preventDefault();
    void sendCode();
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/onboarding/phone/verify-otp", { code });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-surface p-8 shadow-xl">
        {stage === "phone" ? (
          <form onSubmit={requestCode}>
            <h2 className="mb-1 text-xl font-bold text-foreground">Verify your phone number</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              We&apos;ll text you a 6-digit code. This confirms you&apos;re a real person before you
              continue &mdash; your number is never shown publicly.
            </p>

            <PhoneNumberInput value={phoneNumber} onChange={setPhoneNumber} />

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <h2 className="mb-1 text-xl font-bold text-foreground">Enter the code</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              We sent a 6-digit code to {phoneNumber}. It expires in 5 minutes.
            </p>

            {devCode && (
              <p className="mb-3 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300">
                No SMS provider is configured yet, so real texts aren&apos;t sent — dev mode code:{" "}
                <span className="font-mono font-semibold">{devCode}</span>
              </p>
            )}

            <input
              required
              inputMode="numeric"
              placeholder="123456"
              pattern="[0-9]{6}"
              title="Must be a 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-center text-lg tracking-[0.5em] text-foreground"
            />

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Verifying..." : "Verify"}
            </button>

            <button
              type="button"
              disabled={cooldown > 0 || submitting}
              onClick={() => void sendCode()}
              className="mt-3 w-full text-center text-xs text-muted-foreground underline disabled:no-underline disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
