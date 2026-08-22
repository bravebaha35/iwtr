import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "crypto";
import { requireSecret } from "../../config/env";

// Same envelope-encryption shape as apps/api/src/modules/pii-vault/crypto.util.ts,
// but under its own key material — see EmployerProfile's schema.prisma comment
// for why this module doesn't share PiiVault's keys.
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const MASTER_KEY_KDF_SALT = "iwtr-employer-profile-master-key-kdf-v1";

function deriveMasterKey(): Buffer {
  const secret = requireSecret("EMPLOYER_PII_MASTER_KEY", "dev-only-change-me");
  return scryptSync(secret, MASTER_KEY_KDF_SALT, 32);
}

function encrypt(plaintext: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(payload: Buffer, key: Buffer): string {
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function generateDek(): Buffer {
  return randomBytes(32);
}

export function wrapDek(dek: Buffer): Buffer {
  return encrypt(dek.toString("base64"), deriveMasterKey());
}

export function unwrapDek(wrapped: Buffer): Buffer {
  return Buffer.from(decrypt(wrapped, deriveMasterKey()), "base64");
}

export function encryptField(plaintext: string, dek: Buffer): Buffer {
  return encrypt(plaintext, dek);
}

export function decryptField(payload: Buffer, dek: Buffer): string {
  return decrypt(payload, dek);
}

// Unlike PiiVault.tcKimlikNoHash, this is never used to purge/withhold the
// value — see EmployerProfile's schema.prisma comment — only to block a
// second verified-employer profile from registering under the same national
// ID.
export function hashTcKimlikNo(tcKimlikNo: string): string {
  const pepper = requireSecret("EMPLOYER_TCKN_HASH_PEPPER", "dev-only-change-me");
  return createHmac("sha256", pepper).update(tcKimlikNo).digest("hex");
}
