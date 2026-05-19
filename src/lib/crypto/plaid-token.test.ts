import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  decryptPlaidAccessToken,
  encryptPlaidAccessToken,
} from "./plaid-token";

// A Plaid sandbox access_token looks like
// `access-sandbox-12345678-abcd-1234-abcd-1234567890ab`. Use a realistic
// shape so we catch any silent newline/encoding issues in the round-trip.
const FAKE_TOKEN = "access-sandbox-deadbeef-0000-0000-0000-cafebabe0001";

const realKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  // Each test sets a fresh 32-byte key so we don't depend on shell env.
  process.env.PLAID_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

afterEach(() => {
  if (realKey === undefined) {
    delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  } else {
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = realKey;
  }
});

describe("encryptPlaidAccessToken / decryptPlaidAccessToken", () => {
  it("round-trips a token", () => {
    const packed = encryptPlaidAccessToken(FAKE_TOKEN);
    expect(decryptPlaidAccessToken(packed)).toBe(FAKE_TOKEN);
  });

  it("emits the v1 packed format with 4 dot-separated parts", () => {
    const packed = encryptPlaidAccessToken(FAKE_TOKEN);
    const parts = packed.split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
  });

  it("produces a different ciphertext each call (fresh IV)", () => {
    const a = encryptPlaidAccessToken(FAKE_TOKEN);
    const b = encryptPlaidAccessToken(FAKE_TOKEN);
    expect(a).not.toBe(b);
    // But both must decrypt to the same plaintext.
    expect(decryptPlaidAccessToken(a)).toBe(FAKE_TOKEN);
    expect(decryptPlaidAccessToken(b)).toBe(FAKE_TOKEN);
  });

  it("rejects ciphertext modified after the fact (auth-tag check)", () => {
    const packed = encryptPlaidAccessToken(FAKE_TOKEN);
    const [v, iv, ct, tag] = packed.split(".");
    // Flip the first byte of the ciphertext.
    const ctBuf = Buffer.from(ct, "base64");
    ctBuf[0] ^= 0xff;
    const tampered = [v, iv, ctBuf.toString("base64"), tag].join(".");
    expect(() => decryptPlaidAccessToken(tampered)).toThrow();
  });

  it("rejects ciphertext when the key changes (key-bound auth tag)", () => {
    const packed = encryptPlaidAccessToken(FAKE_TOKEN);
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptPlaidAccessToken(packed)).toThrow();
  });

  it("rejects an unknown version prefix", () => {
    const packed = encryptPlaidAccessToken(FAKE_TOKEN);
    const tampered = packed.replace(/^v1\./, "v9.");
    expect(() => decryptPlaidAccessToken(tampered)).toThrow(/unsupported version/);
  });

  it("rejects a malformed packed string", () => {
    expect(() => decryptPlaidAccessToken("not-packed")).toThrow();
    expect(() => decryptPlaidAccessToken("v1.only.three")).toThrow();
    expect(() => decryptPlaidAccessToken("")).toThrow();
  });

  it("rejects encryption when the key is missing", () => {
    delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptPlaidAccessToken(FAKE_TOKEN)).toThrow(
      /PLAID_TOKEN_ENCRYPTION_KEY/,
    );
  });

  it("rejects a wrong-length key", () => {
    // 16 bytes (AES-128 length) — must reject.
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = randomBytes(16).toString("base64");
    expect(() => encryptPlaidAccessToken(FAKE_TOKEN)).toThrow(/32 bytes/);
  });

  it("rejects empty plaintext (programmer error)", () => {
    expect(() => encryptPlaidAccessToken("")).toThrow();
  });
});
