/**
 * The website's case study fields, as its admin defines them
 * (company-website lib/admin/forms/projects.js and the API's
 * PROJECT_WRITABLE list in lib/apiResources.js). One list, used by the AI
 * schema, the Word import, the editor form and the completeness check.
 *
 * Shared by browser and server — no Node imports.
 */

import options from "@/data/website-options.json";

export const ALL_SERVICES = options.serviceGroups.flatMap((g) => g.services);

/** The website stores these as lists (a job can span divisions, sectors, types). */
export const LIST_FIELDS = ["company", "sector", "projectType", "services"];

export const TEMPLATES = [
  { value: "simple", label: "Simple — the essentials", hint: "Scope of works, key works delivered, outcome." },
  { value: "full", label: "Full — challenges, highlights & results", hint: "Adds key challenges & solutions and delivery highlights." },
];

/**
 * label: the website admin's wording. need: "required" (the website rejects
 * it without), "recommended" (a strong case study has it), or "optional".
 */
export const CASE_STUDY_SPEC = {
  template: { label: "Case study type", need: "recommended", group: "Overview" },
  company: { label: "Company", need: "recommended", group: "Overview" },
  title: { label: "Job name", need: "required", group: "Overview", max: 70 },
  area: { label: "Area", need: "recommended", group: "Overview" },
  county: { label: "Borough / county", need: "recommended", group: "Overview" },
  postcode: { label: "Postcode", need: "recommended", group: "Overview", why: "places the map pin" },
  durationWeeks: { label: "Project duration (weeks)", need: "recommended", group: "Overview" },
  addToMap: { label: "Show on the site map", need: "optional", group: "Overview" },
  client: { label: "Client", need: "optional", group: "Overview" },
  projectType: { label: "Type of project", need: "recommended", group: "Classification" },
  sector: { label: "Project sector", need: "recommended", group: "Classification" },
  services: { label: "Services delivered", need: "recommended", group: "Classification", why: "puts it on those service pages" },
  description: { label: "Short summary", need: "required", group: "Summary", max: 300 },
  scopeOfWorks: { label: "Scope of works", need: "recommended", group: "Case study" },
  keyWorks: { label: "Key works delivered", need: "recommended", group: "Case study", template: "simple" },
  keyChallenges: { label: "Key challenges & solutions", need: "recommended", group: "Case study", template: "full" },
  deliveryHighlights: { label: "Project delivery highlights", need: "recommended", group: "Case study", template: "full" },
  projectOutcome: { label: "Project outcome & results", need: "recommended", group: "Case study" },
  testimonialEnabled: { label: "We received a testimonial", need: "optional", group: "Client testimonial" },
  testimonialQuote: { label: "Testimonial", need: "optional", group: "Client testimonial" },
  testimonialAuthor: { label: "Client name", need: "optional", group: "Client testimonial" },
  testimonialRole: { label: "Client role / company", need: "optional", group: "Client testimonial" },
  seoTitle: { label: "Title tag", need: "recommended", group: "SEO", max: 60 },
  metaDescription: { label: "Meta description", need: "recommended", group: "SEO", max: 155 },
  seoH1: { label: "Recommended H1", need: "optional", group: "SEO" },
  primaryKeyword: { label: "Primary keyword", need: "recommended", group: "SEO" },
  supportingKeywords: { label: "Supporting keywords", need: "optional", group: "SEO" },
  seoServiceLinks: { label: "Suggested service links", need: "optional", group: "SEO" },
  mainImageAlt: { label: "Main image alt text", need: "recommended", group: "SEO" },
  seoNotes: { label: "Internal publishing notes", need: "optional", group: "SEO" },
};

export const asList = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

const filled = (v) => (Array.isArray(v) ? v.length > 0 : typeof v === "number" ? Number.isFinite(v) : typeof v === "boolean" ? v : Boolean(String(v ?? "").trim()));

/** Older jobs stored single values; the website takes lists. */
export function normaliseCaseStudy(cs = {}) {
  const out = { ...cs };
  for (const k of LIST_FIELDS) if (k in out) out[k] = asList(out[k]);
  if (!out.template) out.template = out.keyChallenges || out.deliveryHighlights ? "full" : "simple";
  if (out.durationWeeks === "" || out.durationWeeks == null) delete out.durationWeeks;
  else out.durationWeeks = Number(out.durationWeeks) || undefined;
  if (out.testimonialQuote && out.testimonialEnabled == null) out.testimonialEnabled = true;
  return out;
}

/**
 * What's missing before sending: `required` blocks it; `recommended` makes it
 * weaker. Template-specific sections only count for their template.
 */
export function completeness(raw = {}) {
  const cs = normaliseCaseStudy(raw);
  const relevant = Object.entries(CASE_STUDY_SPEC).filter(([, s]) => !s.template || s.template === cs.template);
  const missing = (need) => relevant.filter(([k, s]) => s.need === need && !filled(cs[k])).map(([k, s]) => ({ key: k, label: s.label, why: s.why || null }));
  const counted = relevant.filter(([, s]) => s.need !== "optional");
  const done = counted.filter(([k]) => filled(cs[k])).length;
  const over = relevant.filter(([k, s]) => s.max && String(cs[k] || "").length > s.max).map(([k, s]) => ({ key: k, label: s.label, max: s.max }));
  return { required: missing("required"), recommended: missing("recommended"), tooLong: over, percent: Math.round((done / counted.length) * 100) };
}

/** "Label | /url" lines for the website's Suggested service links field. */
export function serviceLinksFor(services = []) {
  const pages = options.servicePages || [];
  return asList(services)
    .map((s) => pages.find((p) => p.label === s))
    .filter(Boolean)
    .slice(0, 6)
    .map((p) => `${p.label} | ${p.href}`)
    .join("\n");
}
