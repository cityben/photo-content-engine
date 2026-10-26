/**
 * Leads and outreach: find businesses that buy building services (from
 * DataForSEO's Google Maps business listings), track them through a simple
 * pipeline, and write personalised outreach drafts.
 *
 * Nothing is emailed from here. A draft must be approved before it can be
 * copied, opened in an email client or marked as sent — the server enforces
 * that, the same as posts and case studies.
 */

import { randomUUID } from "node:crypto";

import { collection } from "@/lib/store";

import { cleanDomain } from "./seo/analysis";
import { post } from "./seo/dataforseo";

export const LEAD_STAGES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "replied", label: "Replied" },
  { id: "meeting", label: "Meeting" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];
export const LEAD_STAGE_IDS = LEAD_STAGES.map((s) => s.id);

/** Google Maps categories (DataForSEO ids) for people who buy M&E and FM work. */
export const CATEGORY_PRESETS = [
  { id: "property_management_company", label: "Property management", weight: 1 },
  { id: "commercial_real_estate_agency", label: "Commercial property agents", weight: 0.9 },
  { id: "general_contractor", label: "Main contractors", weight: 0.9 },
  { id: "construction_company", label: "Construction companies", weight: 0.8 },
  { id: "coworking_space", label: "Coworking / serviced offices", weight: 0.8 },
  { id: "hotel", label: "Hotels", weight: 0.7 },
  { id: "school", label: "Schools", weight: 0.6 },
  { id: "medical_clinic", label: "Medical clinics", weight: 0.6 },
  { id: "dentist", label: "Dental practices", weight: 0.5 },
  { id: "gym", label: "Gyms", weight: 0.5 },
  { id: "restaurant", label: "Restaurants", weight: 0.4 },
];

export const AREA_PRESETS = [
  { id: "central-london", label: "Central London", lat: 51.5136, lng: -0.1365 },
  { id: "canary-wharf", label: "Canary Wharf", lat: 51.5054, lng: -0.0235 },
  { id: "croydon", label: "Croydon", lat: 51.3762, lng: -0.0982 },
  { id: "maidstone", label: "Maidstone", lat: 51.2704, lng: 0.5227 },
  { id: "canterbury", label: "Canterbury", lat: 51.2802, lng: 1.0789 },
  { id: "tunbridge-wells", label: "Tunbridge Wells", lat: 51.1324, lng: 0.2637 },
  { id: "dartford", label: "Dartford / Bluewater", lat: 51.4469, lng: 0.2193 },
  { id: "ashford", label: "Ashford", lat: 51.1465, lng: 0.875 },
];

const leads = () => collection("leads");
const snapshots = () => collection("market_snapshots");

/**
 * How good a fit a business looks, 0–100: the buyer type (category), size
 * (review count as a proxy), and whether there's a website to research.
 */
export function fitScore({ categoryIds = [], reviews = 0, website }) {
  const weights = CATEGORY_PRESETS.filter((c) => categoryIds.includes(c.id)).map((c) => c.weight);
  const buyer = weights.length ? Math.max(...weights) : 0.3;
  const size = Math.min(1, Math.log10((reviews || 0) + 1) / 2.5); // ~300 reviews ≈ 1
  return Math.round((0.6 * buyer + 0.3 * size + (website ? 0.1 : 0)) * 100);
}

function listingRow(i, categories) {
  const categoryIds = [...new Set([...(i.category_ids || []), ...categories.filter((c) => (i.category_ids || []).includes(c))])];
  const row = {
    cid: i.cid || null,
    name: i.title,
    category: i.category || null,
    categoryIds,
    address: i.address || null,
    city: i.address_info?.city || null,
    postcode: i.address_info?.zip || null,
    phone: i.phone || null,
    website: i.url || null,
    domain: i.domain ? cleanDomain(i.domain) : i.url ? cleanDomain(i.url) : null,
    rating: i.rating?.value ?? null,
    reviews: i.rating?.votes_count ?? 0,
    claimed: i.is_claimed ?? null,
    lat: i.latitude ?? null,
    lng: i.longitude ?? null,
  };
  return { ...row, fit: fitScore(row) };
}

/** Search Google Maps listings around a point. Costs a few cents; the result is stored. */
export async function searchBusinesses({ areaId, lat, lng, radiusKm = 10, categories = [], keyword, minReviews = 0 }) {
  const area = AREA_PRESETS.find((a) => a.id === areaId);
  const point = area ? { lat: area.lat, lng: area.lng } : { lat, lng };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) throw new Error("Pick an area.");
  const filters = minReviews > 0 ? [["rating.votes_count", ">=", minReviews]] : undefined;
  const { result, cost } = await post("/v3/business_data/business_listings/search/live", {
    ...(categories.length && { categories: categories.slice(0, 10) }),
    ...(keyword && { description: keyword.slice(0, 200) }),
    location_coordinate: `${point.lat},${point.lng},${Math.max(1, Math.min(100, radiusKm))}`,
    ...(filters && { filters }),
    order_by: ["rating.votes_count,desc"],
    limit: 100,
  });
  const rows = (result[0]?.items || []).map((i) => listingRow(i, categories)).sort((a, b) => b.fit - a.fit);
  const label = [area?.label || `${point.lat},${point.lng}`, `${radiusKm} km`, categories.join(", ") || "any category", keyword].filter(Boolean).join(" · ");
  return snapshots().insert({ section: "leadsearch", key: "all", data: { label, total: result[0]?.total_count ?? rows.length, rows }, cost });
}

export async function latestSearch() {
  try {
    const [doc] = await snapshots().find({ section: "leadsearch" }, { sort: { createdAt: -1 }, limit: 1 });
    return doc || null;
  } catch {
    return null;
  }
}

/* --- Pipeline ------------------------------------------------------------- */

export async function listLeads() {
  return leads().find({}, { sort: { createdAt: -1 } });
}

export async function getLead(id) {
  return leads().get(id);
}

const activity = (type, text, user) => ({ id: randomUUID(), at: new Date().toISOString(), type, text, by: user?.email || null });

/** Add businesses to the pipeline; skips ones already there (same Google id or website). */
export async function addLeads(rows, user) {
  const existing = await listLeads();
  const cids = new Set(existing.map((l) => l.cid).filter(Boolean));
  const domains = new Set(existing.map((l) => l.domain).filter(Boolean));
  const added = [];
  for (const r of rows) {
    if ((r.cid && cids.has(r.cid)) || (r.domain && domains.has(r.domain))) continue;
    const lead = await leads().insert({
      ...r,
      source: r.source || "maps",
      status: "new",
      contact: { name: "", role: "", email: "" },
      notes: "",
      nextFollowUp: null,
      drafts: [],
      activity: [activity("created", r.source === "manual" ? "Added by hand" : "Added from a Maps search", user)],
      createdBy: user?.email || null,
    });
    if (r.cid) cids.add(r.cid);
    if (r.domain) domains.add(r.domain);
    added.push(lead);
  }
  return { added: added.length, skipped: rows.length - added.length, leads: added };
}

export async function updateLead(id, patch, user) {
  const lead = await getLead(id);
  if (!lead) return null;
  const log = [...(lead.activity || [])];
  if (patch.status && patch.status !== lead.status) {
    log.push(activity("status", `${LEAD_STAGES.find((s) => s.id === lead.status)?.label} → ${LEAD_STAGES.find((s) => s.id === patch.status)?.label}`, user));
  }
  if (patch.note) log.push(activity("note", patch.note, user));
  const { note, ...rest } = patch;
  return leads().update(id, { ...rest, ...(rest.contact && { contact: { ...lead.contact, ...rest.contact } }), activity: log });
}

export async function deleteLead(id) {
  return leads().remove(id);
}

/* --- Outreach drafts ------------------------------------------------------ */

export class DraftNotApproved extends Error {
  constructor() {
    super("Approve this draft before sending it.");
    this.name = "DraftNotApproved";
  }
}

export async function addDraft(id, draft, user) {
  const lead = await getLead(id);
  if (!lead) return null;
  const d = { id: randomUUID(), subject: draft.subject, body: draft.body, model: draft.model || null, costUsd: draft.costUsd ?? null, approved: null, sentAt: null, createdAt: new Date().toISOString(), createdBy: user?.email || null };
  return leads().update(id, { drafts: [d, ...(lead.drafts || [])], activity: [...lead.activity, activity("draft", `Draft written${d.model ? ` by ${d.model}` : ""}: “${d.subject}”`, user)] });
}

/** Edit a draft's text; any change clears its approval. */
export async function editDraft(id, draftId, { subject, body }, user) {
  const lead = await getLead(id);
  const d = lead?.drafts?.find((x) => x.id === draftId);
  if (!d) return null;
  if (d.sentAt) throw new Error("This draft was already sent.");
  const changed = (subject != null && subject !== d.subject) || (body != null && body !== d.body);
  const next = { ...d, subject: subject ?? d.subject, body: body ?? d.body, approved: changed ? null : d.approved, editedBy: user?.email || null };
  return leads().update(id, { drafts: lead.drafts.map((x) => (x.id === draftId ? next : x)) });
}

export async function approveDraft(id, draftId, approved, user) {
  const lead = await getLead(id);
  const d = lead?.drafts?.find((x) => x.id === draftId);
  if (!d) return null;
  const next = { ...d, approved: approved ? { by: user?.email || null, at: new Date().toISOString() } : null };
  return leads().update(id, {
    drafts: lead.drafts.map((x) => (x.id === draftId ? next : x)),
    activity: [...lead.activity, activity("approval", `${approved ? "Approved" : "Unapproved"}: “${d.subject}”`, user)],
  });
}

const addWorkingDays = (date, n) => {
  const d = new Date(date);
  while (n > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n -= 1;
  }
  return d.toISOString().slice(0, 10);
};

/** Record that an approved draft was sent (by hand); sets a follow-up 5 working days out. */
export async function markSent(id, draftId, user, now = new Date()) {
  const lead = await getLead(id);
  const d = lead?.drafts?.find((x) => x.id === draftId);
  if (!d) return null;
  if (!d.approved) throw new DraftNotApproved();
  if (d.sentAt) return lead;
  return leads().update(id, {
    drafts: lead.drafts.map((x) => (x.id === draftId ? { ...x, sentAt: now.toISOString() } : x)),
    status: lead.status === "new" ? "contacted" : lead.status,
    lastContactedAt: now.toISOString(),
    nextFollowUp: addWorkingDays(now, 5),
    activity: [...lead.activity, activity("sent", `Sent: “${d.subject}”`, user)],
  });
}

/** Follow-ups due on or before `today` (YYYY-MM-DD), open leads only. */
export function dueFollowUps(list, today = new Date().toISOString().slice(0, 10)) {
  return list.filter((l) => l.nextFollowUp && l.nextFollowUp <= today && !["won", "lost"].includes(l.status)).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp));
}

/** Our jobs most relevant to a lead (same sector words first, case studies sent first). */
export function relevantJobs(lead, jobs) {
  const words = `${lead.category || ""} ${(lead.categoryIds || []).join(" ")}`.toLowerCase();
  const score = (j) =>
    (j.details?.sector && words.includes(j.details.sector.toLowerCase().split(/[ /&]/)[0]) ? 2 : 0) + (j.website?.projectId ? 1 : 0);
  return [...jobs]
    .filter((j) => j.title && j.title !== "Untitled job")
    .sort((a, b) => score(b) - score(a))
    .slice(0, 5)
    .map((j) => ({ title: j.title, sector: j.details?.sector || null, services: j.details?.services || [], location: j.details?.location || null, onWebsite: Boolean(j.website?.projectId) }));
}
