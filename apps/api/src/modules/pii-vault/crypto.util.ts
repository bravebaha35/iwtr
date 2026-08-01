import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveMasterKey(): Buffer {
  const secret = process.env.PII_MASTER_KEY ?? "dev-only-change-me";
  return createHash("sha256").update(secret).digest();
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

export function hashTcKimlikNo(tcKimlikNo: string): string {
  const pepper = process.env.TCKN_HASH_PEPPER ?? "dev-only-change-me";
  return createHmac("sha256", pepper).update(tcKimlikNo).digest("hex");
}
