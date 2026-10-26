/**
 * The company profile: who the content is written for, and the website's
 * option lists (companies/divisions, sectors, project types, services and
 * service pages) that case studies must match exactly.
 *
 * Kept in the database (Settings → Company profile), not in the code, so the
 * repository carries no company details. Until it's filled in, the AI writes
 * generically and the lists are empty.
 */

import { collection } from "@/lib/store";

const KEY = "company-profile";

export const EMPTY_PROFILE = {
  name: "",
  about: "",
  regions: "",
  founded: "",
  domain: "",
  companies: [],
  sectors: [],
  projectTypes: [],
  serviceGroups: [],
  servicePages: [],
};

const strings = (v, max = 200) => [...new Set((Array.isArray(v) ? v : []).map((s) => String(s).trim()).filter(Boolean))].slice(0, 500).map((s) => s.slice(0, max));

/** Validates and trims an uploaded or edited profile. */
export function cleanProfile(input = {}) {
  return {
    name: String(input.name || "").trim().slice(0, 120),
    about: String(input.about || "").trim().slice(0, 2000),
    regions: String(input.regions || "").trim().slice(0, 200),
    founded: String(input.founded || "").trim().slice(0, 20),
    domain: String(input.domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").slice(0, 253),
    companies: strings(input.companies),
    sectors: strings(input.sectors),
    projectTypes: strings(input.projectTypes),
    serviceGroups: (Array.isArray(input.serviceGroups) ? input.serviceGroups : [])
      .map((g) => ({ division: String(g?.division || "").trim(), company: String(g?.company || "").trim(), services: strings(g?.services) }))
      .filter((g) => g.services.length)
      .slice(0, 50),
    servicePages: (Array.isArray(input.servicePages) ? input.servicePages : [])
      .map((p) => ({ label: String(p?.label || "").trim(), href: String(p?.href || "").trim() }))
      .filter((p) => p.label && /^\/[\w\-/.]*$/.test(p.href))
      .slice(0, 1000),
  };
}

// Next.js can load this module separately for pages and API routes; a cache
// on globalThis is shared, so saving in one clears it for the other.
const cache = (globalThis.__companyProfileCache ||= { memo: null });

export async function getProfile() {
  const { memo } = cache;
  if (memo && Date.now() - memo.at < 30000) return memo.value;
  let value = EMPTY_PROFILE;
  try {
    const [doc] = await collection("settings").find({ key: KEY });
    value = doc?.value ? { ...EMPTY_PROFILE, ...doc.value } : EMPTY_PROFILE;
  } catch (error) {
    console.error("[profile] read failed:", error.message);
  }
  cache.memo = { at: Date.now(), value };
  return value;
}

export async function saveProfile(input, user) {
  const value = cleanProfile(input);
  const settings = collection("settings");
  const [doc] = await settings.find({ key: KEY });
  const record = { key: KEY, value, updatedBy: user?.email || null };
  if (doc) await settings.update(doc.id, record);
  else await settings.insert(record);
  cache.memo = null;
  return value;
}

/** The lists case studies are matched against (safe to send to the browser). */
export function optionsOf(profile = EMPTY_PROFILE) {
  return {
    companies: profile.companies || [],
    sectors: profile.sectors || [],
    projectTypes: profile.projectTypes || [],
    serviceGroups: profile.serviceGroups || [],
    servicePages: profile.servicePages || [],
  };
}

export async function getOptions() {
  return optionsOf(await getProfile());
}

export const allServices = (options) => (options?.serviceGroups || []).flatMap((g) => g.services);

/** One line naming the company for prompts, or a neutral stand-in. */
export function companyLine(profile = EMPTY_PROFILE) {
  const name = profile.name || "the company";
  const parts = [
    `You write for ${name}${profile.founded ? `, trading since ${profile.founded}` : ""}${profile.regions ? `, working across ${profile.regions}` : ""}.`,
    profile.serviceGroups?.length ? `Divisions: ${[...new Set(profile.serviceGroups.map((g) => g.division).filter(Boolean))].join(", ")}.` : "",
    profile.about || "",
  ];
  return parts.filter(Boolean).join(" ");
}
