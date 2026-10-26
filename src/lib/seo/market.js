/**
 * Competitor and market intelligence from DataForSEO, stored as snapshots.
 * Pages read the latest snapshot (free); refreshes cost money and are
 * explicit. Snapshots are kept, so visibility can be charted over time.
 */

import options from "@/data/website-options.json";
import { collection } from "@/lib/store";

import { cleanDomain, keywordRow, organic } from "./analysis";
import { post, UK } from "./dataforseo";

const snapshots = () => collection("market_snapshots");
const settings = () => collection("settings");

export const DEFAULT_SEEDS = [
  "commercial air conditioning",
  "air conditioning installation london",
  "vrf air conditioning",
  "air conditioning maintenance",
  "commercial electrician london",
  "electrical contractor",
  "eicr commercial",
  "mechanical contractor london",
  "commercial heat pump installation",
  "facilities management company",
  "planned preventative maintenance",
  "office fit out m&e",
];

export async function getMarketSettings() {
  let saved = {};
  try {
    const [doc] = await settings().find({ key: "market" });
    saved = doc?.value || {};
  } catch (error) {
    console.error("[market] settings read failed:", error.message);
  }
  return {
    domain: saved.domain || process.env.SITE_DOMAIN || "example.co.uk",
    competitors: saved.competitors || [],
    seeds: saved.seeds?.length ? saved.seeds : DEFAULT_SEEDS,
    // Reputation: the name people search for and the Google Maps area.
    brand: saved.brand || "Acme Ltd",
    location: saved.location || "London,England,United Kingdom",
    rivals: saved.rivals || [],
    auditUrls: saved.auditUrls || [],
  };
}

export async function setMarketSettings(patch, user) {
  const current = await getMarketSettings();
  const value = {
    domain: cleanDomain(patch.domain ?? current.domain),
    competitors: [...new Set((patch.competitors ?? current.competitors).map(cleanDomain))].slice(0, 15),
    seeds: [...new Set((patch.seeds ?? current.seeds).map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, 50),
    brand: (patch.brand ?? current.brand).trim(),
    location: (patch.location ?? current.location).trim(),
    rivals: [...new Set((patch.rivals ?? current.rivals).map((s) => s.trim()).filter(Boolean))].slice(0, 8),
    auditUrls: [...new Set(patch.auditUrls ?? current.auditUrls)].slice(0, 10),
  };
  const [doc] = await settings().find({ key: "market" });
  const record = { key: "market", value, updatedBy: user?.email || null };
  if (doc) await settings().update(doc.id, record);
  else await settings().insert(record);
  return value;
}

async function save(section, key, data, cost) {
  return snapshots().insert({ section, key: key || "all", data, cost });
}

/** Newest snapshot of a section; key null means any key. */
export async function latest(section, key = "all") {
  try {
    const [doc] = await snapshots().find(key === null ? { section } : { section, key }, { sort: { createdAt: -1 }, limit: 1 });
    return doc || null;
  } catch (error) {
    console.error("[market] read failed:", error.message);
    return null;
  }
}

export async function history(section, key = "all", limit = 24) {
  try {
    return (await snapshots().find({ section, key }, { sort: { createdAt: -1 }, limit })).reverse();
  } catch {
    return [];
  }
}

/* --- Refreshes (each costs money) ----------------------------------------- */

/** Who competes with us in Google (shared keywords), biggest overlap first. */
export async function refreshCompetitors() {
  const { domain, competitors } = await getMarketSettings();
  const { result, cost } = await post("/v3/dataforseo_labs/google/competitors_domain/live", {
    target: domain,
    ...UK,
    exclude_top_domains: true,
    limit: 30,
  });
  const items = (result[0]?.items || [])
    .filter((i) => i.domain && cleanDomain(i.domain) !== domain)
    .map((i) => ({
      domain: cleanDomain(i.domain),
      sharedKeywords: i.intersections || 0,
      avgPosition: i.avg_position ? Math.round(i.avg_position * 10) / 10 : null,
      ...organic(i.full_domain_metrics),
      theirTrafficOnShared: Math.round(i.competitor_metrics?.organic?.etv || 0),
      ourTrafficOnShared: Math.round(i.metrics?.organic?.etv || 0),
    }));
  const snap = await save("competitors", "all", items, cost);
  if (!competitors.length && items.length) {
    await setMarketSettings({ competitors: items.slice(0, 6).map((i) => i.domain) });
  }
  return snap;
}

/** Visibility of us and each tracked competitor — one point in their history. */
export async function refreshOverview() {
  const { domain, competitors } = await getMarketSettings();
  const domains = [domain, ...competitors];
  let cost = 0;
  const rows = [];
  for (const d of domains) {
    const r = await post("/v3/dataforseo_labs/google/domain_rank_overview/live", { target: d, ...UK });
    cost += r.cost;
    rows.push({ domain: d, you: d === domain, ...organic(r.result[0]?.items?.[0]?.metrics) });
  }
  return save("overview", "all", rows, cost);
}

/** Keywords a domain ranks for (ours or a competitor's), by traffic. */
export async function refreshRankedKeywords(target) {
  const d = cleanDomain(target);
  const { result, cost } = await post("/v3/dataforseo_labs/google/ranked_keywords/live", {
    target: d,
    ...UK,
    limit: 200,
    order_by: ["ranked_serp_element.serp_item.etv,desc"],
  });
  const items = (result[0]?.items || []).map((i) => {
    const serp = i.ranked_serp_element?.serp_item || {};
    return {
      ...keywordRow(i),
      position: serp.rank_group ?? null,
      url: serp.url || null,
      traffic: Math.round(serp.etv || 0),
      change: serp.rank_changes?.is_new ? "new" : serp.rank_changes?.is_up ? "up" : serp.rank_changes?.is_down ? "down" : null,
      previousPosition: serp.rank_changes?.previous_rank_absolute ?? null,
    };
  });
  return save("ranked", d, items, cost);
}

/** Keyword gap: what `competitor` ranks for and we don't. */
export async function refreshGap(competitor) {
  const { domain } = await getMarketSettings();
  const c = cleanDomain(competitor);
  const { result, cost } = await post("/v3/dataforseo_labs/google/domain_intersection/live", {
    target_1: c,
    target_2: domain,
    ...UK,
    intersections: false,
    limit: 200,
    order_by: ["keyword_data.keyword_info.search_volume,desc"],
  });
  const items = (result[0]?.items || []).map((i) => ({
    ...keywordRow(i),
    theirPosition: i.first_domain_serp_element?.rank_group ?? null,
    theirUrl: i.first_domain_serp_element?.url || null,
  }));
  return save("gap", c, items, cost);
}

/** Demand around our services: ideas with volume, difficulty, value and trend. */
export async function refreshIdeas() {
  const { seeds, domain } = await getMarketSettings();
  const { result, cost } = await post("/v3/dataforseo_labs/google/keyword_ideas/live", {
    keywords: seeds.slice(0, 200),
    ...UK,
    limit: 500,
    order_by: ["keyword_info.search_volume,desc"],
    filters: [["keyword_info.search_volume", ">", 10]],
  });
  const ours = await latest("ranked", domain);
  const positions = new Map((ours?.data || []).map((r) => [r.keyword, r.position]));
  const items = (result[0]?.items || []).map((i) => {
    const row = keywordRow(i);
    const ourPosition = positions.get(row.keyword) ?? null;
    return { ...row, ourPosition, ...(ourPosition && { score: keywordRowScore(row, ourPosition) }) };
  });
  items.sort((a, b) => b.score - a.score);
  return save("ideas", "all", items, cost);
}

function keywordRowScore(row, ourPosition) {
  // Recompute with our position (quick-win bonus) without re-flattening.
  return Math.min(100, row.score + (ourPosition > 3 && ourPosition <= 20 ? 5 : 0));
}

/** Google Trends interest over 5 years for up to 5 keywords (seasonality). */
export async function refreshTrends(keywords) {
  const list = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 5);
  if (!list.length) throw new Error("Pick up to 5 keywords.");
  const { result, cost } = await post("/v3/keywords_data/google_trends/explore/live", {
    keywords: list,
    location_code: 2826,
    language_code: "en",
    type: "web",
    time_range: "past_5_years",
    item_types: ["google_trends_graph"],
  });
  const graph = (result[0]?.items || []).find((i) => i.type === "google_trends_graph");
  const points = (graph?.data || [])
    .filter((p) => !p.missing_data)
    .map((p) => ({ date: p.date_from, ...Object.fromEntries(list.map((k, idx) => [k, p.values?.[idx] ?? null])) }));
  return save("trends", list.join("|"), { keywords: list, points, averages: graph?.averages || [] }, cost);
}

/** Who ranks for our money keywords — the leaders in our niche, overlap or not. */
export async function refreshSerpLeaders() {
  const { seeds, domain } = await getMarketSettings();
  const { result, cost } = await post("/v3/dataforseo_labs/google/serp_competitors/live", {
    keywords: seeds.slice(0, 200),
    ...UK,
    limit: 30,
    item_types: ["organic"],
  });
  const items = (result[0]?.items || []).map((i) => ({
    domain: cleanDomain(i.domain),
    you: cleanDomain(i.domain) === domain,
    avgPosition: i.avg_position ? Math.round(i.avg_position * 10) / 10 : null,
    keywordsCount: i.keywords_count || 0,
    traffic: Math.round(i.etv || 0),
    visibility: i.visibility != null ? Math.round(i.visibility * 1000) / 10 : null,
  }));
  return save("leaders", "all", items, cost);
}

export const REFRESHERS = {
  competitors: () => refreshCompetitors(),
  overview: () => refreshOverview(),
  leaders: () => refreshSerpLeaders(),
  ideas: () => refreshIdeas(),
  ranked: ({ domain }) => refreshRankedKeywords(domain),
  gap: ({ domain }) => refreshGap(domain),
  trends: ({ keywords }) => refreshTrends(keywords || []),
};

export const SERVICE_SEEDS = options.serviceGroups.map((g) => g.services[0]);
