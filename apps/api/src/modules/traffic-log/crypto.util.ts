import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "crypto";
import { requireSecret } from "../../config/env";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTION_KEY_KDF_SALT = "iwtr-traffic-log-encryption-kdf-v1";

// Deliberately separate keys from pii-vault/crypto.util.ts and
// phone-verification/crypto.util.ts — a compromised traffic-log key should
// never expose identity-vault or phone data, and vice versa.
function deriveEncryptionKey(): Buffer {
  const secret = requireSecret("TRAFFIC_LOG_ENCRYPTION_KEY", "dev-only-change-me");
  return scryptSync(secret, ENCRYPTION_KEY_KDF_SALT, 32);
}

// Reversible on purpose: Law 5651 requires being able to hand a real IP to
// authorities on a lawful request, which a one-way hash could never satisfy.
export function encryptIp(ip: string): Buffer {
  const key = deriveEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(ip, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptIp(payload: Buffer): string {
  const key = deriveEncryptionKey();
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// Non-reversible fingerprint kept alongside the encrypted value purely for
// internal lookups (e.g. abuse-pattern detection) without ever decrypting.
export function hashIp(ip: string): string {
  const pepper = requireSecret("TRAFFIC_LOG_HASH_PEPPER", "dev-only-change-me");
  return createHmac("sha256", pepper).update(ip).digest("hex");
}
