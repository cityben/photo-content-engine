/**
 * Who may sign in. Kept free of Auth.js imports so it can be unit tested.
 *
 * Access is granted when the account's email is on AUTH_ALLOWED_EMAILS, or its
 * domain is on AUTH_ALLOWED_DOMAINS (default: example.co.uk) — and the
 * identity provider vouches for that email:
 *   - Google: the email must be verified, and for domain access the account
 *     must belong to that Google Workspace (the `hd` claim).
 *   - Microsoft: the account must come from your own Entra ID tenant (`tid`),
 *     because Entra email claims are not verified across tenants.
 */

export const DEFAULT_ALLOWED_DOMAINS = "example.co.uk";

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
  const address = (email || profile.email || "").trim().toLowerCase();
  if (!address.includes("@")) return false;

  const domain = address.split("@").pop();
  const allowedEmails = csv(env.AUTH_ALLOWED_EMAILS);
  const allowedDomains = csv(env.AUTH_ALLOWED_DOMAINS ?? DEFAULT_ALLOWED_DOMAINS);
  const byEmail = allowedEmails.includes(address);
  const byDomain = allowedDomains.includes(domain);

  if (!byEmail && !byDomain) return false;

  if (provider === "google") {
    if (profile.email_verified !== true) return false;
    if (byEmail) return true;
    return typeof profile.hd === "string" && profile.hd.toLowerCase() === domain;
  }

  if (provider === "microsoft-entra-id") {
    const tenantId = tenantIdFromIssuer(env.AUTH_MICROSOFT_ENTRA_ID_ISSUER);
    if (!tenantId) return false;
    return typeof profile.tid === "string" && profile.tid.toLowerCase() === tenantId;
  }

  return false;
}
