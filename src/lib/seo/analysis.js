/**
 * Pure helpers that turn DataForSEO rows into decisions. No I/O — tested in
 * tests/market.test.js.
 */

/**
 * Year-on-year change in searches, from monthly_searches (newest first or
 * any order): last 3 months vs the same 3 months a year earlier. null if
 * there isn't 15 months of data.
 */
export function trendPercent(monthly = []) {
  const rows = [...(monthly || [])]
    .filter((m) => m && Number.isFinite(m.search_volume))
    .sort((a, b) => b.year - a.year || b.month - a.month);
  if (rows.length < 15) return null;
  const recent = rows.slice(0, 3).reduce((s, m) => s + m.search_volume, 0);
  const lastYear = rows.slice(12, 15).reduce((s, m) => s + m.search_volume, 0);
  if (!lastYear) return recent ? 100 : 0;
  return Math.round(((recent - lastYear) / lastYear) * 100);
}

/**
 * How worth chasing a keyword is, 0–100: demand (volume, log-scaled),
 * commercial value (CPC), buying intent, ease (100 − difficulty) and
 * momentum. A ranking for it already 4–20 makes it a quick win.
 */
export function opportunityScore({ volume = 0, cpc = 0, difficulty = 50, intent, trend = null, ourPosition = null }) {
  const demand = Math.min(1, Math.log10((volume || 0) + 1) / 4); // 10k/mo ≈ 1
  const value = Math.min(1, (cpc || 0) / 15); // £15+ CPC ≈ 1
  const ease = 1 - Math.min(100, Math.max(0, difficulty ?? 50)) / 100;
  const buying = intent === "commercial" || intent === "transactional" ? 1 : intent === "navigational" ? 0.2 : 0.5;
  const momentum = trend == null ? 0.5 : Math.min(1, Math.max(0, 0.5 + trend / 200));
  const quickWin = ourPosition && ourPosition > 3 && ourPosition <= 20 ? 1 : 0;
  const score = 0.3 * demand + 0.2 * value + 0.2 * ease + 0.15 * buying + 0.1 * momentum + 0.05 * quickWin;
  return Math.round(score * 100);
}

/** Flatten a Labs KeywordDataInfo (with or without the keyword_data wrapper). */
export function keywordRow(item) {
  const k = item.keyword_data || item;
  const info = k.keyword_info || {};
  const props = k.keyword_properties || {};
  const row = {
    keyword: k.keyword,
    volume: info.search_volume ?? 0,
    cpc: info.cpc ?? 0,
    competition: info.competition_level || null,
    difficulty: props.keyword_difficulty ?? null,
    intent: k.search_intent_info?.main_intent || null,
    trend: trendPercent(info.monthly_searches),
    monthly: (info.monthly_searches || [])
      .slice()
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .slice(-12)
      .map((m) => m.search_volume),
  };
  row.score = opportunityScore(row);
  return row;
}

/** Organic metrics from a Labs metrics map. */
export function organic(metrics) {
  const m = metrics?.organic || {};
  return {
    traffic: Math.round(m.etv || 0),
    keywords: m.count || 0,
    top3: (m.pos_1 || 0) + (m.pos_2_3 || 0),
    top10: (m.pos_1 || 0) + (m.pos_2_3 || 0) + (m.pos_4_10 || 0),
    newKeywords: m.is_new || 0,
    lostKeywords: m.is_lost || 0,
    up: m.is_up || 0,
    down: m.is_down || 0,
  };
}

export function cleanDomain(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function isValidDomain(d) {
  return /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(d);
}

/* --- Reputation, links and site health ------------------------------------ */

/**
 * Review stats from normalised reviews ({ rating, date, replied }):
 * average, share replied to, how many in the last 90 days, and a monthly
 * series (newest 12 months) for a chart.
 */
export function reviewStats(reviews = [], now = new Date()) {
  const rated = reviews.filter((r) => Number.isFinite(r.rating));
  const avg = rated.length ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10 : null;
  const cutoff = now.getTime() - 90 * 864e5;
  const recent = reviews.filter((r) => r.date && new Date(r.date).getTime() >= cutoff);
  const months = new Map();
  for (const r of reviews) {
    if (!r.date) continue;
    const key = String(r.date).slice(0, 7);
    const m = months.get(key) || { month: key, count: 0, sum: 0 };
    m.count += 1;
    m.sum += r.rating || 0;
    months.set(key, m);
  }
  const monthly = [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)
    .map((m) => ({ month: m.month, count: m.count, average: Math.round((m.sum / m.count) * 10) / 10 }));
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: rated.filter((r) => Math.round(r.rating) === star).length }));
  return {
    count: reviews.length,
    average: avg,
    repliedShare: reviews.length ? Math.round((reviews.filter((r) => r.replied).length / reviews.length) * 100) : null,
    last90: recent.length,
    unanswered: reviews.filter((r) => !r.replied && (r.rating ?? 5) <= 3).length,
    distribution,
    monthly,
  };
}

/**
 * DataForSEO OnPage "checks" are booleans; for most, true means a problem,
 * for a few (https, canonical…) true is good. Plain-English labels for the
 * ones that matter to a services site; anything else is ignored.
 */
const CHECKS = {
  is_4xx_code: ["Page returns an error (4xx)", "high"],
  is_5xx_code: ["Server error (5xx)", "high"],
  is_broken: ["Page is broken", "high"],
  no_title: ["No title tag", "high"],
  no_h1_tag: ["No H1 heading", "high"],
  no_description: ["No meta description", "medium"],
  title_too_long: ["Title too long — Google will cut it off", "low"],
  title_too_short: ["Title too short", "low"],
  duplicate_title_tag: ["More than one title tag", "medium"],
  duplicate_meta_tags: ["Duplicate meta tags", "low"],
  low_content_rate: ["Little text compared with code", "medium"],
  low_character_count: ["Thin content (very little text)", "medium"],
  low_readability_rate: ["Hard to read", "low"],
  irrelevant_description: ["Description doesn't match the page", "low"],
  irrelevant_title: ["Title doesn't match the page", "medium"],
  no_image_alt: ["Images without alt text", "medium"],
  high_loading_time: ["Slow to load", "high"],
  high_waiting_time: ["Slow server response (TTFB)", "medium"],
  has_render_blocking_resources: ["Render-blocking scripts or styles", "low"],
  large_page_size: ["Heavy page", "medium"],
  size_greater_than_3mb: ["Page over 3 MB", "high"],
  https_to_http_links: ["Links to insecure http:// pages", "low"],
  is_redirect: ["Redirects to another URL", "low"],
  has_meta_refresh_redirect: ["Meta refresh redirect", "medium"],
  no_favicon: ["No favicon", "low"],
  lorem_ipsum: ["Placeholder (lorem ipsum) text", "high"],
  has_misspelling: ["Spelling mistakes", "low"],
  canonical_to_broken: ["Canonical points to a broken page", "high"],
  recursive_canonical: ["Canonical loop", "medium"],
};
const GOOD_WHEN_TRUE = { is_https: ["Not served over HTTPS", "high"], seo_friendly_url: ["URL isn't search-friendly", "low"] };

export function auditIssues(checks = {}) {
  const issues = [];
  for (const [key, [label, severity]] of Object.entries(CHECKS)) if (checks[key] === true) issues.push({ key, label, severity });
  for (const [key, [label, severity]] of Object.entries(GOOD_WHEN_TRUE)) if (checks[key] === false) issues.push({ key, label, severity });
  const order = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Link prospects from a Backlinks domain_intersection result: each item maps
 * target index → the referring domain's link to that target. Domains linking
 * to more competitors (and with higher rank) come first.
 */
export function linkProspects(items = [], targets = {}) {
  return items
    .map((item) => {
      const entries = Object.entries(item.domain_intersection || {});
      const first = entries[0]?.[1] || {};
      return {
        domain: cleanDomain(first.target),
        rank: Math.max(0, ...entries.map(([, v]) => v?.rank || 0)),
        linksTo: entries.filter(([, v]) => v?.backlinks).map(([k]) => targets[k]).filter(Boolean),
        backlinks: entries.reduce((s, [, v]) => s + (v?.backlinks || 0), 0),
        spamScore: first.backlinks_spam_score ?? null,
      };
    })
    .filter((p) => p.domain)
    .sort((a, b) => b.linksTo.length - a.linksTo.length || b.rank - a.rank);
}
