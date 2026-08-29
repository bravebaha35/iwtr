import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { requireSecret } from "../../config/env";

// Same shape as phone-verification/crypto.util.ts's OTP helpers, but with
// its own pepper secret (ADMIN_OTP_PEPPER) rather than reusing
// PHONE_HASH_PEPPER — a compromised phone-OTP secret shouldn't also be able
// to forge an admin login code, and vice versa (same isolation reasoning as
// the separate phone/PII encryption keys documented elsewhere in this repo).
function hmac(value: string): string {
  const pepper = requireSecret("ADMIN_OTP_PEPPER", "dev-only-change-me");
  return createHmac("sha256", pepper).update(value).digest("hex");
}

export function generateAdminOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Salted per-challenge-row (userId), same reasoning as hashOtpCode: two
// users (or two challenges) issued the same 6-digit code never hash equal.
export function hashAdminOtpCode(code: string, userId: string): string {
  return hmac(`admin-otp:${userId}:${code}`);
}

export function adminOtpHashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
