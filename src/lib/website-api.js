/**
 * Acme Ltd website API client (cityben/company-website).
 *
 * Uses the supported v1 API: POST {site}/api/v1/projects with an API key
 * from the website's /admin/api-keys page — role editor, scopes content:write
 * and media:write — sent as `Authorization: Bearer cc_live_…`.
 *
 * Photos are uploaded first (POST /uploads, multipart "file"), because the
 * site only renders images it hosts under /uploads. Case studies are always
 * created with published:false — leaving it out would publish immediately.
 *
 * The address and key are set on the Settings page (key encrypted at rest);
 * env vars are the fallback.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { getStoredImage } from "@/lib/media";
import { isPrivateAddress } from "@/lib/remote-file";
import { hintFor, openSecret, sealSecret } from "@/lib/secret-box";
import { collection } from "@/lib/store";

const DEFAULT_SITE = "https://www.example.co.uk";
const SETTINGS_KEY = "website-connection";

/**
 * "https://example.com", "https://example.com/" or "https://example.com/api/v1"
 * → { siteUrl: "https://example.com", apiBase: "https://example.com/api/v1" }.
 */
export function normaliseApiUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Enter the website address.");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:") throw new Error("Use an https:// address.");
  url.hash = "";
  url.search = "";
  const path = url.pathname.replace(/\/+$/, "");
  const base = path.endsWith("/api/v1") ? path.slice(0, -"/api/v1".length) : path;
  const siteUrl = `${url.origin}${base}`;
  return { siteUrl, apiBase: `${siteUrl}/api/v1` };
}

// Settings are read on most requests; keep them for 30s.
let memo = null;
async function saved() {
  if (memo && Date.now() - memo.at < 30000) return memo.value;
  let value = null;
  try {
    const [doc] = await collection("settings").find({ key: SETTINGS_KEY });
    value = doc?.value || null;
  } catch (error) {
    console.error("[website] settings read failed:", error.message);
  }
  memo = { at: Date.now(), value };
  return value;
}

/**
 * Where the website is and the key to use. The Settings page wins; the
 * WEBSITE_API_KEY / NEXT_PUBLIC_WEBSITE_URL env vars are the fallback.
 */
export async function websiteConfig() {
  const s = await saved();
  const envUrl = process.env.WEBSITE_API_BASE || process.env.NEXT_PUBLIC_WEBSITE_URL || DEFAULT_SITE;
  const { siteUrl, apiBase } = normaliseApiUrl(s?.apiUrl || envUrl);
  let apiKey = "";
  let keySource = null;
  let keyError = null;
  if (s?.apiKey) {
    try {
      apiKey = openSecret(s.apiKey);
      keySource = "settings";
    } catch {
      keyError = "The saved API key can't be read (AUTH_SECRET changed?). Enter it again.";
    }
  }
  const envKey = process.env.WEBSITE_API_KEY || process.env.WEBSITE_API_TOKEN || "";
  if (!apiKey && envKey) {
    apiKey = envKey;
    keySource = "env";
  }
  return { siteUrl, apiBase, apiKey, urlSource: s?.apiUrl ? "settings" : "env", keySource, keyHint: hintFor(apiKey), keyError, updatedBy: s?.updatedBy || null, updatedAt: s?.updatedAt || null };
}

/** What the Settings page may show — never the key itself. */
export async function websiteConfigPublic() {
  const { apiKey, ...rest } = await websiteConfig();
  return { ...rest, configured: Boolean(apiKey) };
}

export async function websiteConfigured() {
  return Boolean((await websiteConfig()).apiKey);
}

/** The API must be on the public internet (this runs on our server). */
async function assertPublicHost(apiBase) {
  const { hostname } = new URL(apiBase);
  if (hostname === "localhost") throw new Error("That address isn't on the public internet.");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error(`Can't find ${hostname} — check the address.`);
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error("That address isn't on the public internet.");
}

/**
 * Save the address and/or key from Settings. An empty key keeps the saved
 * one; `clearKey` removes it (falling back to the env var, if any).
 */
export async function saveWebsiteConnection({ apiUrl, apiKey, clearKey }, user) {
  const current = (await saved()) || {};
  const next = { ...current, updatedBy: user?.email || null, updatedAt: new Date().toISOString() };
  if (apiUrl !== undefined) {
    if (apiUrl) {
      const { apiBase } = normaliseApiUrl(apiUrl);
      await assertPublicHost(apiBase);
      next.apiUrl = apiBase;
    } else delete next.apiUrl;
  }
  if (clearKey) delete next.apiKey;
  else if (apiKey) next.apiKey = sealSecret(apiKey.trim());
  const settings = collection("settings");
  const [doc] = await settings.find({ key: SETTINGS_KEY });
  if (doc) await settings.update(doc.id, { key: SETTINGS_KEY, value: next });
  else await settings.insert({ key: SETTINGS_KEY, value: next });
  memo = null;
  return websiteConfigPublic();
}

/** Fields the website's v1 API accepts for a project (lib/apiResources.js PROJECT_WRITABLE). */
export const CASE_STUDY_FIELDS = [
  "title", "slug", "description", "company", "sector", "projectType", "services",
  "client", "area", "county", "dateStarted", "dateCompleted", "durationWeeks",
  "writeUp", "scopeOfWorks", "keyWorks", "keyChallenges", "deliveryHighlights", "projectOutcome",
  "testimonialEnabled", "testimonialQuote", "testimonialAuthor", "testimonialRole",
  "seoTitle", "metaDescription", "seoH1", "primaryKeyword", "supportingKeywords",
  "mainImageAlt", "seoNotes", "mainImage", "images", "previewImages", "published",
];

export class WebsiteError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "WebsiteError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = "GET", body, headers = {} } = {}, config) {
  const { apiBase, apiKey: key } = config || (await websiteConfig());
  if (!key) throw new WebsiteError("The website isn't connected. Add its address and API key in Settings.");

  let res;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, ...headers },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    const reason = error.name === "TimeoutError" ? "timed out" : error.cause?.code || error.message;
    throw new WebsiteError(`Couldn't reach ${apiBase} (${reason}). Check the address in Settings.`);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error || {};
    const detail = err.details ? ` (${Object.entries(err.details).map(([k, v]) => `${k}: ${v}`).join("; ")})` : "";
    const hint =
      res.status === 404 && !err.message
        ? ` — ${apiBase} has no v1 API. Check the address in Settings points at the new website (e.g. https://staging.example.co.uk until launch).`
        : res.status === 401 && !err.message
          ? " — the API key was rejected."
          : "";
    throw new WebsiteError(`${err.message || `Website API error ${res.status}`}${detail}${hint}`, {
      status: res.status,
      code: err.code,
      details: err.details,
    });
  }
  return json?.data ?? json;
}

async function imageBytes(url) {
  if (url.startsWith("/api/media/")) {
    const stored = await getStoredImage(url.split("/").pop());
    if (!stored) throw new WebsiteError("A job photo is missing from storage.");
    return stored;
  }
  const res = await fetch(url);
  if (!res.ok) throw new WebsiteError(`Couldn't fetch photo ${url} (${res.status})`);
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "image/jpeg" };
}

/** Upload one photo to the website. Returns its site path, e.g. /uploads/ab12….jpg */
export async function uploadImage({ url, alt, title, company }) {
  const { bytes, contentType } = await imageBytes(url);
  const form = new FormData();
  if (alt) form.append("alt", alt.slice(0, 300));
  if (title) form.append("title", title.slice(0, 200));
  if (company) form.append("company", company);
  form.append("folder", "case-studies");
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  form.append("file", new Blob([bytes], { type: contentType }), `photo.${ext}`);
  const data = await request("/uploads", { method: "POST", body: form });
  return data.url;
}

function pick(fields) {
  const out = {};
  for (const key of CASE_STUDY_FIELDS) {
    const v = fields[key];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && !v.length) continue;
    out[key] = v;
  }
  return out;
}

/**
 * Create a draft case study. `photos`: [{ url, alt }] — the first is the hero.
 * `idempotencyKey` stops a retry creating a duplicate.
 */
export async function createCaseStudyDraft({ caseStudy, photos = [], idempotencyKey }) {
  const company = Array.isArray(caseStudy.company) ? caseStudy.company[0] : caseStudy.company;
  const uploaded = [];
  for (const [i, photo] of photos.entries()) {
    uploaded.push(
      await uploadImage({
        url: photo.url,
        alt: photo.alt || (i === 0 ? caseStudy.mainImageAlt : caseStudy.title),
        title: caseStudy.title,
        company,
      })
    );
  }

  const body = pick({
    ...caseStudy,
    mainImage: uploaded[0],
    images: uploaded,
    previewImages: uploaded.slice(1, 4),
    published: false,
  });

  const project = await request("/projects", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey && { "Idempotency-Key": idempotencyKey }),
    },
  });

  const { siteUrl } = await websiteConfig();
  return {
    projectId: project._id,
    slug: project.slug,
    url: `${siteUrl}/case-studies/${project.slug}`,
    adminUrl: `${siteUrl}/admin`,
    images: uploaded,
    status: project.published ? "published" : "draft",
  };
}

/** Update an existing case study (partial). */
export async function updateCaseStudy(idOrSlug, fields) {
  const project = await request(`/projects/${encodeURIComponent(idOrSlug)}`, {
    method: "PATCH",
    body: JSON.stringify(pick(fields)),
    headers: { "Content-Type": "application/json" },
  });
  return { projectId: project._id, slug: project.slug, status: project.published ? "published" : "draft" };
}

/**
 * Who the key belongs to — the Settings check. Pass { apiUrl, apiKey } to
 * test values before saving them; otherwise the saved connection is used.
 */
export async function checkWebsiteConnection(candidate) {
  let config = await websiteConfig();
  if (candidate) {
    const { siteUrl, apiBase } = candidate.apiUrl ? normaliseApiUrl(candidate.apiUrl) : config;
    await assertPublicHost(apiBase);
    config = { ...config, siteUrl, apiBase, apiKey: candidate.apiKey || config.apiKey };
  }
  if (!config.apiKey) return { configured: false, ok: false, apiBase: config.apiBase };
  try {
    const me = await request("/me", {}, config);
    return { configured: true, ok: true, me, apiBase: config.apiBase };
  } catch (error) {
    return { configured: true, ok: false, error: error.message, apiBase: config.apiBase };
  }
}

/* --- Reports (needs scope analytics:read on the key) -----------------------
   The website keeps its own copy of Google Search Console, GA4 and Business
   Profile data (company-website docs/REPORTS.md). These give the
   keyword and traffic screens real numbers instead of estimates. */

function reportQuery({ from, to, ...rest } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  for (const [k, v] of Object.entries(rest)) if (v !== undefined && v !== "") params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Search Console queries: { rows: [{ key, clicks, impressions, ctr, position, positionChange, clicksChange }], bands, totalQueries } */
export async function getSearchQueries({ from, to, limit = 100, q } = {}) {
  return request(`/reports/queries${reportQuery({ from, to, limit, q })}`);
}

/** Headline KPIs with comparison: { kpis: { users: { now, previous, change }, gscClicks: … }, narrative } */
export async function getReportSummary({ from, to } = {}) {
  return request(`/reports/summary${reportQuery({ from, to })}`);
}

/** GA4 channels and source/medium — shows visits arriving from LinkedIn/Instagram. */
export async function getTrafficReport({ from, to } = {}) {
  return request(`/reports/traffic${reportQuery({ from, to })}`);
}

/** Search Console pages, GA4 top pages and landing pages. */
export async function getPagesReport({ from, to, limit = 25 } = {}) {
  return request(`/reports/pages${reportQuery({ from, to, limit })}`);
}
