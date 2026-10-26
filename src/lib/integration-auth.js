/**
 * API keys for other systems (e.g. your other project) calling /api/v1/*.
 *
 * INTEGRATION_API_KEYS = comma-separated `name:key` pairs, keys ≥ 32 chars.
 * Create one with: npm run new-api-key -- atlas
 * Sent as `Authorization: Bearer <key>`. Compared as SHA-256 digests in
 * constant time; the name is only used for logs and "created by".
 */

import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s) => createHash("sha256").update(s).digest();

export function integrationKeys(value = process.env.INTEGRATION_API_KEYS) {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const i = entry.indexOf(":");
      return i > 0 ? { name: entry.slice(0, i), key: entry.slice(i + 1) } : { name: "integration", key: entry };
    })
    .filter((k) => k.key.length >= 32);
}

/** The matching key's name, or null. */
export function checkIntegrationKey(request, keys = integrationKeys()) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !keys.length) return null;
  const given = digest(match[1].trim());
  let found = null;
  for (const k of keys) {
    if (timingSafeEqual(given, digest(k.key))) found = k.name; // no early exit
  }
  return found;
}

export function requireIntegration(request) {
  const name = checkIntegrationKey(request);
  if (!name) {
    return {
      name: null,
      response: Response.json(
        { error: { code: "unauthorized", message: "Send a valid API key as Authorization: Bearer <key>." } },
        { status: 401 }
      ),
    };
  }
  return { name, response: null };
}
