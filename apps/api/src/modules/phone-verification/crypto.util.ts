import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "crypto";
import { requireSecret } from "../../config/env";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTION_KEY_KDF_SALT = "iwtr-phone-encryption-kdf-v1";

function hmac(context: string, value: string): string {
  const pepper = requireSecret("PHONE_HASH_PEPPER", "dev-only-change-me");
  return createHmac("sha256", pepper).update(`${context}:${value}`).digest("hex");
}

function deriveEncryptionKey(): Buffer {
  const secret = requireSecret("PHONE_ENCRYPTION_KEY", "dev-only-change-me");
  return scryptSync(secret, ENCRYPTION_KEY_KDF_SALT, 32);
}

// Same envelope layout as pii-vault/crypto.util.ts (iv + authTag + ciphertext)
// but a separate key — a compromised phone-encryption key shouldn't also
// expose the PII vault, and vice versa. Used to retain the verified phone
// number so a user can see it back on their own account-settings page; the
// dedup hash above stays the only thing anything else ever queries against.
export function encryptPhoneNumber(phoneE164: string): Buffer {
  const key = deriveEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(phoneE164, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptPhoneNumber(payload: Buffer): string {
  const key = deriveEncryptionKey();
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function hashPhoneNumber(phoneE164: string): string {
  return hmac("phone", phoneE164);
}

// Derived from the canonical phone hash (not the raw number, which is never
// retained past the send step) plus the submitter's own userId, so it can
// never collide with the real owner's hash or another flagged account's.
export function collisionPhoneHash(canonicalPhoneHash: string, userId: string): string {
  return hmac("phone-collision", `${canonicalPhoneHash}:${userId}`);
}

// Salted per-user so identical codes issued to different users never hash
// the same.
export function hashOtpCode(code: string, userId: string): string {
  return hmac("otp", `${code}:${userId}`);
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
