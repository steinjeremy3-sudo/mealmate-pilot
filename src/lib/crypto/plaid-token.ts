// Encryption for Plaid `access_token` values stored in `plaid_items`.
//
// The access_token is a long-lived bearer credential. Anyone holding it
// can read the diner's bank transactions (and, in higher Plaid envs,
// account/balance data) until the Item is invalidated. We therefore
// store it encrypted at rest. Even with full DB access (a leaked
// service-role key, a backup that got loose), an attacker still needs
// PLAID_TOKEN_ENCRYPTION_KEY to read tokens.
//
// Cipher: AES-256-GCM. GCM gives us authenticated encryption — the
// 16-byte auth tag detects tampering, so we'll throw on any modified
// ciphertext rather than silently returning garbage.
//
// Storage format (single text column):
//   v1.{iv_b64}.{ciphertext_b64}.{auth_tag_b64}
//
// The `v1` prefix is a version tag so we can rotate keys / change
// algorithms later without a schema migration: read paths can dispatch
// on the version, write paths always use the current version.
//
// Key management:
//   - PLAID_TOKEN_ENCRYPTION_KEY = 32 raw bytes, base64-encoded in env.
//   - Generate with: `openssl rand -base64 32`
//   - Never log, never expose to clients. (We don't add `import
//     "server-only"` here because we want this module unit-testable in
//     vitest's Node env, and the `node:crypto` import already makes it
//     unusable from a Client Component.)
//   - Rotating: bump to v2 (new env var), keep v1 decrypt path until all
//     rows are re-encrypted (Phase 4c+ concern).

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16; // GCM tag
const VERSION = "v1";

/**
 * Read + validate the encryption key once per process. Lazy so unit
 * tests can stub the env var per-test.
 */
function getKey(): Buffer {
  const raw = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PLAID_TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env.local.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `PLAID_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}). Regenerate with \`openssl rand -base64 32\`.`,
    );
  }
  return key;
}

/** Encrypt a Plaid access_token. Returns the packed `v1.iv.ct.tag` string. */
export function encryptPlaidAccessToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error("encryptPlaidAccessToken: empty plaintext");
  }
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    ciphertext.toString("base64"),
    authTag.toString("base64"),
  ].join(".");
}

/**
 * Decrypt a packed Plaid access_token string. Throws on:
 *   - unknown version
 *   - malformed packing
 *   - failed auth tag (tampered ciphertext or wrong key)
 */
export function decryptPlaidAccessToken(packed: string): string {
  if (!packed) {
    throw new Error("decryptPlaidAccessToken: empty input");
  }
  const parts = packed.split(".");
  if (parts.length !== 4) {
    throw new Error(
      `decryptPlaidAccessToken: expected 4 dot-separated parts, got ${parts.length}`,
    );
  }
  const [version, ivB64, ctB64, tagB64] = parts;
  if (version !== VERSION) {
    throw new Error(`decryptPlaidAccessToken: unsupported version ${version}`);
  }
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error(`decryptPlaidAccessToken: bad iv length ${iv.length}`);
  }
  if (authTag.length !== TAG_LENGTH) {
    throw new Error(
      `decryptPlaidAccessToken: bad auth tag length ${authTag.length}`,
    );
  }
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(), // throws if auth tag check fails
  ]);
  return plaintext.toString("utf8");
}
