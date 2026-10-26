/**
 * Who may sign in through Microsoft. Kept free of Auth.js imports so it can
 * be unit tested. (Email + password accounts are allowed by being listed in
 * AUTH_USERS — see passwords.js.)
 *
 * A Microsoft account is let in when it comes from your own Entra ID tenant
 * (`tid`) — Entra email claims are not verified across tenants — and its email
 * is on AUTH_ALLOWED_EMAILS or its domain is on AUTH_ALLOWED_DOMAINS
 * (no default: Microsoft sign-in stays closed until one is set).
 */

export const DEFAULT_ALLOWED_DOMAINS = "";

function csv(value) {
  return (value || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export function tenantIdFromIssuer(issuer) {
  const match = (issuer || "").match(
    /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i
  );
  return match ? match[1].toLowerCase() : null;
}

export function isAllowedSignIn({ provider, profile = {}, email }, env = process.env) {
  // authorize() in src/auth.js has already checked the password.
  if (provider === "credentials") return true;

  if (provider !== "microsoft-entra-id") return false;

  const address = (email || profile.email || "").trim().toLowerCase();
  if (!address.includes("@")) return false;

  const domain = address.split("@").pop();
  const listed =
    csv(env.AUTH_ALLOWED_EMAILS).includes(address) ||
    csv(env.AUTH_ALLOWED_DOMAINS ?? DEFAULT_ALLOWED_DOMAINS).includes(domain);
  if (!listed) return false;

  const tenantId = tenantIdFromIssuer(env.AUTH_MICROSOFT_ENTRA_ID_ISSUER);
  if (!tenantId) return false;
  return typeof profile.tid === "string" && profile.tid.toLowerCase() === tenantId;
}
