/**
 * Acme Ltd website API client (cityben/company-website).
 *
 * Uses the supported v1 API: POST {WEBSITE_API_BASE}/projects with an API key
 * from the website's /admin/api-keys page — role editor, scopes content:write
 * and media:write — sent as `Authorization: Bearer cc_live_…`.
 *
 * Photos are uploaded first (POST /uploads, multipart "file"), because the
 * site only renders images it hosts under /uploads. Case studies are always
 * created with published:false — leaving it out would publish immediately.
 */

import { getStoredImage } from "@/lib/media";

export const WEBSITE_URL = (process.env.NEXT_PUBLIC_WEBSITE_URL || "https://www.example.co.uk").replace(/\/$/, "");
const API_BASE = (process.env.WEBSITE_API_BASE || `${WEBSITE_URL}/api/v1`).replace(/\/$/, "");

export function websiteApiKey() {
  // WEBSITE_API_TOKEN is accepted for older setups that used that name.
  return process.env.WEBSITE_API_KEY || process.env.WEBSITE_API_TOKEN || "";
}

export function websiteConfigured() {
  return Boolean(websiteApiKey());
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

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const key = websiteApiKey();
  if (!key) throw new WebsiteError("WEBSITE_API_KEY is not set");

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...headers },
    body,
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error || {};
    const detail = err.details ? ` (${Object.entries(err.details).map(([k, v]) => `${k}: ${v}`).join("; ")})` : "";
    throw new WebsiteError(`${err.message || `Website API error ${res.status}`}${detail}`, {
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

  return {
    projectId: project._id,
    slug: project.slug,
    url: `${WEBSITE_URL}/case-studies/${project.slug}`,
    adminUrl: `${WEBSITE_URL}/admin`,
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

/** Who the key belongs to — used by the Settings page to check the connection. */
export async function checkWebsiteConnection() {
  if (!websiteConfigured()) return { configured: false, ok: false };
  try {
    const me = await request("/me");
    return { configured: true, ok: true, me };
  } catch (error) {
    return { configured: true, ok: false, error: error.message };
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
