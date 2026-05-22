// Generic at-rest token encryption (AES-256-GCM).
//
// Used for any long-lived bearer credential we must store — Plaid
// access tokens and Astra OAuth tokens. GCM gives authenticated
// encryption: a tampered ciphertext throws on decrypt rather than
// returning garbage.
//
// Storage format (single text column): v1.{iv_b64}.{ct_b64}.{tag_b64}
// The v1 prefix lets us rotate keys / algorithms later.
//
// Key: PLAID_TOKEN_ENCRYPTION_KEY — 32 raw bytes, base64-encoded in
// env. Named for its first use; it is the project's token-encryption
// key and is reused here. Generate with `openssl rand -base64 32`.
// (No `import "server-only"` so this stays unit-testable under vitest;
// the node:crypto import already keeps it out of client bundles.)

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = "v1";

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
      `PLAID_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}).`,
    );
  }
  return key;
}

/** Encrypt a token. Returns the packed `v1.iv.ct.tag` string. */
export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error("encryptToken: empty plaintext");
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

/** Decrypt a packed token string. Throws on tampering or a wrong key. */
export function decryptToken(packed: string): string {
  if (!packed) throw new Error("decryptToken: empty input");
  const parts = packed.split(".");
  if (parts.length !== 4) {
    throw new Error(
      `decryptToken: expected 4 dot-separated parts, got ${parts.length}`,
    );
  }
  const [version, ivB64, ctB64, tagB64] = parts;
  if (version !== VERSION) {
    throw new Error(`decryptToken: unsupported version ${version}`);
  }
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error(`decryptToken: bad iv length ${iv.length}`);
  }
  if (authTag.length !== TAG_LENGTH) {
    throw new Error(`decryptToken: bad auth tag length ${authTag.length}`);
  }
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
