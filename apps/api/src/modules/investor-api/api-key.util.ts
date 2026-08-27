import { randomBytes, createHash } from "crypto";

// Same shape as auth/token.service.ts's refresh-token hashing — a random
// high-entropy key, only its SHA-256 hash ever touches the database.
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}
