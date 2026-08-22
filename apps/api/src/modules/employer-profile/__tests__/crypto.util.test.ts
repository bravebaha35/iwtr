import {
  decryptField,
  encryptField,
  generateDek,
  hashTcKimlikNo,
  unwrapDek,
  wrapDek,
} from "../crypto.util";

describe("employer-profile crypto.util", () => {
  it("round-trips a field through encrypt/decrypt under the same DEK", () => {
    const dek = generateDek();
    const encrypted = encryptField("10000000146", dek);
    expect(decryptField(encrypted, dek)).toBe("10000000146");
  });

  it("round-trips a DEK through wrap/unwrap", () => {
    const dek = generateDek();
    const wrapped = wrapDek(dek);
    const unwrapped = unwrapDek(wrapped);
    expect(unwrapped.equals(dek)).toBe(true);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const dek = generateDek();
    const a = encryptField("Ahmet", dek);
    const b = encryptField("Ahmet", dek);
    expect(a.equals(b)).toBe(false);
    expect(decryptField(a, dek)).toBe("Ahmet");
    expect(decryptField(b, dek)).toBe("Ahmet");
  });

  it("fails to decrypt under the wrong DEK (auth tag mismatch)", () => {
    const dek = generateDek();
    const otherDek = generateDek();
    const encrypted = encryptField("secret", dek);
    expect(() => decryptField(encrypted, otherDek)).toThrow();
  });

  it("hashTcKimlikNo is deterministic for the same input", () => {
    expect(hashTcKimlikNo("10000000146")).toBe(hashTcKimlikNo("10000000146"));
  });

  it("hashTcKimlikNo produces different hashes for different inputs", () => {
    expect(hashTcKimlikNo("10000000146")).not.toBe(hashTcKimlikNo("10000000123"));
  });
});
