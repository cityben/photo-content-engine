/**
 * The dashboard's reading of the numbers: headline KPIs with change, why the
 * site isn't ranking for the searches that matter, what's working, what's
 * trending in the niche and how the tracked competitors are moving.
 *
 * Everything here reads data the tool already holds (website reports,
 * DataForSEO snapshots, Buffer) — no paid calls. The analysis functions are
 * pure so they can be tested on fixtures (tests/dashboard.test.js).
 */

import { cached } from "@/lib/cache";
import { listIdeas } from "@/lib/ideas";
import { cleanDomain } from "@/lib/seo/analysis";
import { getMarketSettings, history, latest } from "@/lib/seo/market";
import { analytics } from "@/lib/social";
import { collection } from "@/lib/store";
import { getPagesReport, getReportSummary, getSearchQueries, websiteConfig, websiteConfigured } from "@/lib/website-api";

const DAY = 864e5;
const isoDay = (d) => d.toISOString().slice(0, 10);
const norm = (k) => String(k || "").trim().toLowerCase();

/** Typical organic click-through by position (first page), for "shown but not clicked". */
const EXPECTED_CTR = [0, 0.28, 0.16, 0.11, 0.08, 0.065, 0.05, 0.04, 0.032, 0.027, 0.023];
export const expectedCtr = (position) => (position >= 1 && position <= 10 ? EXPECTED_CTR[Math.round(position)] : null);

/* --- Why you're not ranking ---------------------------------------------- */

/**
 * The searches worth winning, each with where we stand, who's beating us
 * and the reasons, worst gap first. Inputs are the stored snapshots:
 * queries (Search Console rows), ranked (our ranked keywords), demand
 * (keyword ideas), gaps ([{ competitor, rows }]), backlinks rows, audit
 * pages, and the ideas already in the pipeline.
 */
export function rankingDiagnosis({ queries = [], ranked = [], demand = [], gaps = [], backlinks = [], audit = [], pipeline = [], limit = 12 }) {
  const byKey = new Map();
  const get = (keyword) => {
    const k = norm(keyword);
    if (!byKey.has(k)) byKey.set(k, { keyword: k, volume: null, difficulty: null, intent: null, ourPosition: null, ourUrl: null, impressions: null, clicks: null, ctr: null, positionChange: null, competitors: [] });
    return byKey.get(k);
  };

  for (const q of queries) {
    if ((q.impressions || 0) < 20 || !(q.position > 3)) continue;
    Object.assign(get(q.key), { ourPosition: q.position, impressions: q.impressions, clicks: q.clicks, ctr: q.ctr ?? null, positionChange: q.positionChange ?? null });
  }
  const rankedBy = new Map(ranked.map((r) => [norm(r.keyword), r]));
  for (const d of demand) {
    if ((d.volume || 0) < 30 || (d.ourPosition && d.ourPosition <= 3)) continue;
    if (!["commercial", "transactional"].includes(d.intent) && (d.score ?? 0) < 55) continue;
    Object.assign(get(d.keyword), { volume: d.volume, difficulty: d.difficulty, intent: d.intent });
  }
  for (const g of gaps) {
    for (const r of (g.rows || []).slice(0, 60)) {
      if ((r.volume || 0) < 30 || !r.theirPosition || r.theirPosition > 10) continue;
      if (!["commercial", "transactional"].includes(r.intent) && r.volume < 200) continue;
      const row = get(r.keyword);
      row.volume ??= r.volume;
      row.difficulty ??= r.difficulty;
      row.intent ??= r.intent;
      row.competitors.push({ domain: g.competitor, position: r.theirPosition, url: r.theirUrl || null });
    }
  }
  for (const row of byKey.values()) {
    const r = rankedBy.get(row.keyword);
    if (r) {
      row.ourPosition ??= r.position;
      row.ourUrl = r.url || null;
      row.volume ??= r.volume;
      row.difficulty ??= r.difficulty;
    }
    row.competitors.sort((a, b) => a.position - b.position);
  }

  const us = backlinks.find((b) => b.you);
  const theirs = new Map(backlinks.filter((b) => !b.you).map((b) => [b.domain, b]));
  const pages = new Map(audit.filter((p) => p.url).map((p) => [p.url.replace(/\/$/, ""), p]));
  const inPipeline = new Map(pipeline.filter((i) => i.keyword).map((i) => [norm(i.keyword), i]));

  const rows = [...byKey.values()].map((row) => {
    const reasons = [];
    const best = row.competitors[0];
    if (!row.ourPosition) {
      reasons.push({ kind: "no-page", label: "No page ranks for it", detail: best ? `${best.domain} is #${best.position}${best.url ? ` with ${best.url.replace(/^https?:\/\/(www\.)?/, "")}` : ""}.` : "Nothing on the site targets this search." });
    } else if (row.ourPosition > 10) {
      reasons.push({ kind: "page-two", label: `Page ${Math.ceil(row.ourPosition / 10)} (#${Math.round(row.ourPosition)})`, detail: "Google has a page for it but ranks others first — strengthen that page and link to it from related pages." });
    }
    const typical = expectedCtr(row.ourPosition);
    if (typical && row.ctr != null && row.impressions >= 50 && row.ctr < typical * 0.6) {
      reasons.push({ kind: "low-ctr", label: "Shown, not clicked", detail: `${(row.ctr * 100).toFixed(1)}% click-through vs about ${(typical * 100).toFixed(0)}% typical at #${Math.round(row.ourPosition)} — rewrite the title and description.` });
    }
    if (row.positionChange != null && row.positionChange <= -1.5) {
      reasons.push({ kind: "slipping", label: `Slipping ${Math.abs(row.positionChange).toFixed(1)} places`, detail: "Lost ground against the previous period." });
    }
    const rival = best && theirs.get(best.domain);
    if (us && rival && rival.referringDomains > Math.max(10, us.referringDomains * 1.5)) {
      reasons.push({ kind: "authority", label: "Authority gap", detail: `${rival.domain} has ${rival.referringDomains.toLocaleString("en-GB")} referring domains to your ${us.referringDomains.toLocaleString("en-GB")}.` });
    }
    if (row.difficulty != null && row.difficulty >= 55) {
      reasons.push({ kind: "hard", label: `Hard search (difficulty ${row.difficulty})`, detail: "Needs a strong page and links; target longer variants first." });
    }
    const page = row.ourUrl && pages.get(row.ourUrl.replace(/\/$/, ""));
    if (page?.issues?.length) {
      reasons.push({ kind: "page-issues", label: "Page problems", detail: page.issues.slice(0, 3).map((i) => i.label).join(", ") + "." });
    }
    // Rough size of the prize: searches a month, scaled by how far off page one we are.
    const demandSize = row.volume ?? (row.impressions ? Math.round(row.impressions / 3) : 0);
    const distance = row.ourPosition ? Math.min(1, Math.max(0.15, (row.ourPosition - 3) / 20)) : 1;
    const idea = inPipeline.get(row.keyword);
    return {
      ...row,
      competitors: row.competitors.slice(0, 3),
      reasons,
      opportunity: Math.round(demandSize * distance),
      fix: fixFor(row, reasons),
      pipeline: idea ? { id: idea.id, status: idea.status, jobId: idea.jobId || null } : null,
    };
  });

  return rows.filter((r) => r.reasons.length).sort((a, b) => b.opportunity - a.opportunity).slice(0, limit);
}

function fixFor(row, reasons) {
  const kinds = new Set(reasons.map((r) => r.kind));
  if (kinds.has("no-page")) return "Write a page or article that answers it, and link to it from the matching service page.";
  if (kinds.has("low-ctr")) return "Rewrite the page title and meta description to match the search.";
  if (kinds.has("page-issues")) return "Fix the page problems, then add depth: FAQs, photos from real jobs, a case study link.";
  if (kinds.has("page-two")) return "Expand the page and point two or three related pages and case studies at it.";
  if (kinds.has("authority")) return "Win links: suppliers, trade bodies and clients linking to your case studies.";
  if (kinds.has("slipping")) return "Refresh the page — date, photos, a recent job — and check what replaced you.";
  return "Target a longer, more specific version first.";
}

/* --- What's working ------------------------------------------------------ */

const metric = (post, type) => post.metrics?.find((m) => m.type === type)?.value ?? 0;

export function whatsWorking({ queries = [], ranked = [], pages = [], posts = [] }) {
  return {
    risingQueries: queries
      .filter((q) => (q.clicksChange ?? 0) > 0 || (q.positionChange ?? 0) >= 1)
      .sort((a, b) => (b.clicksChange ?? 0) - (a.clicksChange ?? 0) || (b.positionChange ?? 0) - (a.positionChange ?? 0))
      .slice(0, 6)
      .map((q) => ({ query: q.key, clicks: q.clicks, clicksChange: q.clicksChange ?? null, position: q.position, positionChange: q.positionChange ?? null })),
    movingUp: ranked
      .filter((r) => r.change === "up" || r.change === "new")
      .sort((a, b) => (b.traffic || 0) - (a.traffic || 0) || (b.volume || 0) - (a.volume || 0))
      .slice(0, 6)
      .map((r) => ({ keyword: r.keyword, position: r.position, previous: r.previousPosition, isNew: r.change === "new", volume: r.volume })),
    topPages: [...pages]
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      .slice(0, 5)
      .map((p) => ({ page: p.page || p.key || p.url, clicks: p.clicks || 0, impressions: p.impressions || 0, position: p.position ?? null })),
    topPosts: posts
      .filter((p) => p.metrics?.length)
      .sort((a, b) => metric(b, "engagementRate") * Math.log10(metric(b, "impressions") + 10) - metric(a, "engagementRate") * Math.log10(metric(a, "impressions") + 10))
      .slice(0, 3)
      .map((p) => ({ id: p.id, service: p.service, text: p.text.slice(0, 140), sentAt: p.sentAt, impressions: metric(p, "impressions"), engagementRate: metric(p, "engagementRate") })),
  };
}

/* --- What's trending ----------------------------------------------------- */

/** Change in a series of snapshots per domain: [{ createdAt, data: [{ domain, traffic }] }]. */
export function competitorMoves(overviewHistory = []) {
  const domains = new Map();
  for (const snap of overviewHistory) {
    for (const row of snap.data || []) {
      if (!domains.has(row.domain)) domains.set(row.domain, { domain: row.domain, you: Boolean(row.you), points: [] });
      domains.get(row.domain).points.push({ at: snap.createdAt, traffic: row.traffic || 0, keywords: row.keywords || 0, top10: row.top10 || 0 });
    }
  }
  return [...domains.values()].map((d) => {
    const last = d.points.at(-1);
    const before = d.points.at(-2);
    return { ...d, traffic: last?.traffic ?? 0, keywords: last?.keywords ?? 0, top10: last?.top10 ?? 0, change: before?.traffic ? (last.traffic - before.traffic) / before.traffic : null };
  });
}

export function whatsTrending({ demand = [], queries = [], overviewHistory = [], ai = null, seeds = [] }) {
  const seedWords = new Set(seeds.flatMap((s) => norm(s).split(/\s+/)).filter((w) => w.length > 3));
  return {
    risingSearches: demand
      .filter((d) => d.trend != null && d.trend >= 15 && (d.volume || 0) >= 30)
      .sort((a, b) => b.trend * Math.log10(b.volume + 10) - a.trend * Math.log10(a.volume + 10))
      .slice(0, 8)
      .map((d) => ({ keyword: d.keyword, volume: d.volume, trend: d.trend, monthly: d.monthly || [], ourPosition: d.ourPosition ?? null })),
    newSearches: queries
      .filter((q) => !q.prevClicks && q.prevPosition == null && (q.impressions || 0) >= 20)
      .filter((q) => !seedWords.size || norm(q.key).split(/\s+/).some((w) => seedWords.has(w)))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5)
      .map((q) => ({ query: q.key, impressions: q.impressions, position: q.position })),
    competitorMovers: competitorMoves(overviewHistory)
      .filter((d) => !d.you && d.change != null && Math.abs(d.change) >= 0.1)
      .sort((a, b) => b.change - a.change)
      .slice(0, 4)
      .map(({ domain, change, traffic }) => ({ domain, change, traffic })),
    aiQuestions: (ai?.questions || []).slice(0, 5).map((q) => ({ question: q.question, volume: q.volume, brands: q.brands || [] })),
  };
}

/* --- Competitor snapshot ------------------------------------------------- */

export function competitorTable({ overviewHistory = [], backlinks = [], leaders = [], domain }) {
  const moves = competitorMoves(overviewHistory);
  const links = new Map(backlinks.map((b) => [b.domain, b]));
  const lead = new Map(leaders.map((l) => [l.domain, l]));
  const rows = moves.map((m) => ({
    domain: m.domain,
    you: m.you || m.domain === domain,
    traffic: m.traffic,
    change: m.change,
    keywords: m.keywords,
    top10: m.top10,
    trend: m.points.slice(-12).map((p) => p.traffic),
    referringDomains: links.get(m.domain)?.referringDomains ?? null,
    authority: links.get(m.domain)?.rank ?? null,
    nicheVisibility: lead.get(m.domain)?.visibility ?? null,
    nichePosition: lead.get(m.domain)?.avgPosition ?? null,
  }));
  const total = rows.reduce((s, r) => s + r.traffic, 0);
  return rows.map((r) => ({ ...r, share: total ? r.traffic / total : null })).sort((a, b) => b.traffic - a.traffic);
}

/* --- Loading ------------------------------------------------------------- */

async function safe(promise, fallback) {
  try {
    return await promise;
  } catch (error) {
    console.error("[dashboard]", error.message);
    return fallback;
  }
}

async function websiteReports() {
  if (!(await websiteConfigured())) return { configured: false };
  const now = new Date();
  const range = { from: isoDay(new Date(now.getTime() - 28 * DAY)), to: isoDay(now) };
  const { siteUrl } = await websiteConfig();
  try {
    const { value } = await cached(`dashboard-website-${siteUrl}`, 3 * 3600000, async () => {
      const errors = [];
      const keep = (name) => (e) => (errors.push(`${name}: ${e.message}`), null);
      const [summary, queries, pages] = await Promise.all([
        getReportSummary(range).catch(keep("summary")),
        getSearchQueries({ ...range, limit: 500 }).catch(keep("queries")),
        getPagesReport({ ...range, limit: 50 }).catch(keep("pages")),
      ]);
      if (!summary && !queries && !pages) throw new Error(errors.join(" · "));
      return { summary, queries, pages, errors };
    });
    return { configured: true, ...value };
  } catch (error) {
    return { configured: true, error: error.message };
  }
}

async function socialPeriods() {
  const now = Date.now();
  const window = (from, to) => analytics({ start: new Date(from).toISOString(), end: new Date(to).toISOString() });
  const [current, previous] = await Promise.all([window(now - 28 * DAY, now), window(now - 56 * DAY, now - 28 * DAY)]);
  return { current, previous };
}

export async function dashboardData() {
  const settings = await safe(getMarketSettings(), { domain: "", competitors: [], seeds: [] });
  const domain = settings.domain;
  const [website, social, overviewHistory, ranked, demand, backlinks, audit, ai, leaders, gapSnaps, pipeline] = await Promise.all([
    websiteReports(),
    safe(socialPeriods(), null),
    safe(history("overview", "all", 12), []),
    domain ? safe(latest("ranked", domain), null) : null,
    safe(latest("ideas"), null),
    safe(latest("backlinks"), null),
    safe(latest("audit"), null),
    safe(latest("ai"), null),
    safe(latest("leaders"), null),
    safe(collection("market_snapshots").find({ section: "gap" }, { sort: { createdAt: -1 }, limit: 12 }), []),
    safe(listIdeas(), []),
  ]);

  // Newest gap snapshot per tracked competitor.
  const tracked = new Set(settings.competitors.map(cleanDomain));
  const gaps = [];
  const seen = new Set();
  for (const g of gapSnaps) {
    if (seen.has(g.key) || (tracked.size && !tracked.has(g.key))) continue;
    seen.add(g.key);
    gaps.push({ competitor: g.key, rows: g.data || [], at: g.createdAt });
  }

  const queries = website.queries?.rows || [];
  const marketAt = [overviewHistory.at(-1)?.createdAt, ranked?.createdAt, demand?.createdAt, ...gaps.map((g) => g.at)].filter(Boolean).sort().at(-1) || null;

  return {
    domain,
    website,
    social,
    marketAt,
    hasMarket: Boolean(overviewHistory.length || ranked || demand || gaps.length),
    ranking: rankingDiagnosis({ queries, ranked: ranked?.data || [], demand: demand?.data || [], gaps, backlinks: backlinks?.data || [], audit: audit?.data || [], pipeline }),
    working: whatsWorking({ queries, ranked: ranked?.data || [], pages: website.pages?.search || [], posts: social?.current?.posts || [] }),
    trending: whatsTrending({ demand: demand?.data || [], queries, overviewHistory, ai: ai?.data, seeds: settings.seeds }),
    competitors: competitorTable({ overviewHistory, backlinks: backlinks?.data || [], leaders: leaders?.data || [], domain }),
  };
}
