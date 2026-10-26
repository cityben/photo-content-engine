/**
 * Encrypts secrets saved from the Settings page (AES-256-GCM). The key is
 * derived from AUTH_SECRET, so a database copy on its own can't be read.
 * Changing AUTH_SECRET makes saved secrets unreadable — re-enter them.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set, so secrets can't be saved securely.");
  return Buffer.from(hkdfSync("sha256", secret, "photo-content-engine", "settings-secrets-v1", 32));
}

export function sealSecret(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

export function openSecret(box) {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(box.iv, "base64"));
  decipher.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(box.data, "base64")), decipher.final()]).toString("utf8");
}

/** "cc_live_ab12…wxyz" — enough to recognise a key, not to use it. */
export function hintFor(secret) {
  if (!secret) return null;
  return secret.length <= 14 ? `${secret.slice(0, 4)}…` : `${secret.slice(0, 10)}…${secret.slice(-4)}`;
}
