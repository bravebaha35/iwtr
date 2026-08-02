import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "crypto";
import { requireSecret } from "../../config/env";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
// Fixed application-level salt for the master-key KDF. This does not need to
// be secret or per-record — it just stops PII_MASTER_KEY from being usable
// directly as a rainbow-table/precomputed-hash input, and gives the
// derivation a real (if fixed-cost) work factor instead of a bare fast hash.
const MASTER_KEY_KDF_SALT = "iwtr-pii-vault-master-key-kdf-v1";

function deriveMasterKey(): Buffer {
  const secret = requireSecret("PII_MASTER_KEY", "dev-only-change-me");
  return scryptSync(secret, MASTER_KEY_KDF_SALT, 32);
}

// AES-256-GCM encrypt; output layout is [iv][authTag][ciphertext] so decryption
// never needs anything beyond the key and this single buffer.
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

/**
 * Envelope encryption: each PiiVault row gets its own random Data Encryption Key
 * (DEK), which itself is encrypted ("wrapped") under the server-wide master key
 * (Key Encryption Key). Rotating the master key later only means re-wrapping
 * DEKs, not re-encrypting every field.
 */
export function generateDek(): Buffer {
  return randomBytes(32);
}

export function wrapDek(dek: Buffer): Buffer {
  return encrypt(dek.toString("base64"), deriveMasterKey());
}

export function encryptField(plaintext: string, dek: Buffer): Buffer {
  return encrypt(plaintext, dek);
}

export function unwrapDek(wrapped: Buffer): Buffer {
  return Buffer.from(decrypt(wrapped, deriveMasterKey()), "base64");
}

// Only ever call this to show a user their OWN previously-submitted name/
// birth date back to themselves (see PiiVaultService.getMyIdentity) — never
// for any cross-user or public-facing lookup. T.C. Kimlik No has no decrypt
// path at all; encTcKimlikNo is nulled out the moment it's no longer needed
// (see purgeTcKimlikNoIfPresent) specifically so it can never be read back,
// by this function or anything else.
export function decryptField(payload: Buffer, dek: Buffer): string {
  return decrypt(payload, dek);
}

export function hashTcKimlikNo(tcKimlikNo: string): string {
  const pepper = requireSecret("TCKN_HASH_PEPPER", "dev-only-change-me");
  return createHmac("sha256", pepper).update(tcKimlikNo).digest("hex");
}
