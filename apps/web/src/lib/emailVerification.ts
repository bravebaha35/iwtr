import { ALLOWED_REGISTRATION_EMAIL_DOMAINS } from "@iwtr/shared-types";

// Frontend-only prototype for the registration email-verification step.
// There is no backend endpoint for this yet (see CLAUDE.md — real email
// delivery is a later phase), so "sending" a code just means generating one
// client-side and "verifying" means comparing against that same in-memory
// value. This must not be mistaken for a real security boundary: nothing
// here is enforced server-side, so an account created through this flow is
// no more verified than one created without it. Swap this out once a real
// backend email-OTP endpoint exists, the same way ModerationService is
// documented as a stand-in for a future AI-backed implementation.

// Near-miss domains for the exact strings registerEmailInputSchema accepts —
// catches the keystroke typos, not a general spell-checker.
const COMMON_TYPO_DOMAINS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmailcom": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotmali.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outloo.com": "outlook.com",
  "outlokk.com": "outlook.com",
  "windowlive.com": "windowslive.com",
  "windowslive.co": "windowslive.com",
  "windowlives.com": "windowslive.com",
};

/**
 * Instant client-side check, ahead of the network round trip the backend's
 * own allowlist (registerEmailInputSchema) would otherwise require to reject
 * the same address. Returns an error message to show, or null if the email
 * is well-formed and on an allowed domain.
 */
export function validateRegistrationEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const match = /^[^\s@]+@([^\s@]+)$/.exec(trimmed);
  if (!match) return "Enter a valid email address.";

  const domain = match[1];
  if (ALLOWED_REGISTRATION_EMAIL_DOMAINS.includes(domain)) return null;

  const suggestion = COMMON_TYPO_DOMAINS[domain];
  if (suggestion) return `Did you mean @${suggestion}? Double-check your email address.`;

  return `Please use an email address from: ${ALLOWED_REGISTRATION_EMAIL_DOMAINS.join(", ")}.`;
}

export function generateMockOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const DEV_BYPASS_CODES = ["999999", "123456"];

/**
 * Only ever true in a local dev build. `process.env.NODE_ENV` is inlined by
 * Next.js's build-time compiler (same mechanism React uses to strip its own
 * dev-only warnings), so a production build has this whole branch — codes
 * included — dead-code-eliminated out of the shipped bundle entirely, not
 * just hidden behind a runtime flag a user could flip.
 */
export function isDevBypassCode(code: string): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  return DEV_BYPASS_CODES.includes(code);
}

const STORAGE_KEY = "iwtr:pending-email-verification";

export interface PendingVerification {
  email: string;
  sentAt: number;
}

// sessionStorage (not localStorage): this is tab-scoped and clears when the
// tab closes, which matters because the only thing worth persisting here is
// the email address — the password and the generated code are deliberately
// kept in React state only and never written to any Storage API, so a
// refresh mid-verification asks the visitor to re-enter their password
// rather than ever having held it at rest client-side.
export function savePendingVerification(state: PendingVerification): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can throw in privacy-locked-down browsers — losing
    // refresh-resilience isn't worth crashing the signup flow over.
  }
}

export function loadPendingVerification(): PendingVerification | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingVerification;
  } catch {
    return null;
  }
}

export function clearPendingVerification(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // see savePendingVerification
  }
}
