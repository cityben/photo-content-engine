/**
 * Email + password accounts, without a database.
 *
 * Accounts live in the AUTH_USERS environment variable as comma-separated
 * `email|hash` pairs. Hashes come from `npm run hash-password` and use scrypt
 * (Node's built-in, memory-hard password hash), so plain passwords are never
 * stored anywhere. Hash format: scrypt.<log2 N>.<r>.<p>.<salt>.<key>, base64url
 * parts — no `$`, which .env loaders would try to expand.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

const PARAMS = { logN: 15, r: 8, p: 1 };
const KEY_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 12;

function scryptOptions({ logN, r, p }) {
  const N = 2 ** logN;
  // Default maxmem (32MB) is exactly 128*N*r at logN=15; leave headroom.
  return { N, r, p, maxmem: 256 * N * r };
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, scryptOptions(PARAMS));
  return [
    "scrypt",
    PARAMS.logN,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join(".");
}

function parseHash(stored) {
  const parts = (stored || "").split(".");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [, logN, r, p, salt, key] = parts;
  const params = { logN: Number(logN), r: Number(r), p: Number(p) };
  if (![params.logN, params.r, params.p].every(Number.isInteger)) return null;
  if (params.logN < 14 || params.logN > 20) return null;
  return { params, salt: Buffer.from(salt, "base64url"), key: Buffer.from(key, "base64url") };
}

// Verified against when the email is unknown, so a wrong email takes as long
// as a wrong password and doesn't reveal which accounts exist.
const DUMMY_HASH =
  "scrypt.15.8.1.AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function verifyPassword(password, stored) {
  const parsed = parseHash(stored) || parseHash(DUMMY_HASH);
  const key = await scrypt(
    String(password ?? "").normalize("NFKC"),
    parsed.salt,
    parsed.key.length,
    scryptOptions(parsed.params)
  );
  return Boolean(parseHash(stored)) && timingSafeEqual(key, parsed.key);
}

/** AUTH_USERS → Map of lower-cased email → hash. Malformed entries are skipped. */
export function parseUsers(value = process.env.AUTH_USERS) {
  const users = new Map();
  for (const entry of (value || "").split(",")) {
    const [email, hash] = entry.trim().split("|");
    if (email?.includes("@") && parseHash(hash)) {
      users.set(email.trim().toLowerCase(), hash.trim());
    }
  }
  return users;
}

export async function checkCredentials(email, password, users = parseUsers()) {
  const address = String(email ?? "").trim().toLowerCase();
  const stored = users.get(address);
  const ok = await verifyPassword(password, stored);
  return ok && stored ? address : null;
}

/**
 * Brute-force brake: after 5 failures for an email or an IP within 15
 * minutes, further attempts are refused until the window passes. In-memory,
 * so it's per server instance — a speed bump, not a guarantee.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map();

function recent(key, now) {
  const times = (failures.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (times.length) failures.set(key, times);
  else failures.delete(key);
  return times;
}

export function isLockedOut(keys, now = Date.now()) {
  return keys.some((key) => key && recent(key, now).length >= MAX_FAILURES);
}

export function recordFailure(keys, now = Date.now()) {
  for (const key of keys) {
    if (key) failures.set(key, [...recent(key, now), now]);
  }
}

export function clearFailures(keys) {
  for (const key of keys) failures.delete(key);
}
