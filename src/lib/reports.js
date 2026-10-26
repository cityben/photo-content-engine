/**
 * Monthly growth report: one month of website, search, social, work shipped,
 * market and reputation numbers, an AI executive summary, and CSV exports.
 * Reads stored data only — no paid DataForSEO calls.
 */

import { generateReportSummary } from "@/lib/ai";
import { cached } from "@/lib/cache";
import { listIdeas } from "@/lib/ideas";
import { listJobs } from "@/lib/jobs";
import { history } from "@/lib/seo/market";
import { analytics } from "@/lib/social";
import { collection } from "@/lib/store";
import { getPagesReport, getReportSummary, getSearchQueries, getTrafficReport, websiteConfig, websiteConfigured } from "@/lib/website-api";

import { socialReferrals } from "./growth";

const reports = () => collection("reports");

/** The website's KPI ids (lib/reports/catalog.js there) worth a tile here, in order. */
export const KPI_LABELS = {
  users: "Website users",
  sessions: "Sessions",
  gscClicks: "Organic search clicks",
  gscImpressions: "Search impressions",
  gscPosition: "Average search position",
  gbpImpressions: "Business Profile views",
  gbpCalls: "Calls from Business Profile",
  gbpWebsiteClicks: "Website clicks from Business Profile",
  enquiries: "Enquiries",
  siteCalls: "Phone clicks on the website",
};

/** "2026-10" → { from, to, start, end, label, partial }. The current month runs to today. */
export function monthRange(month, now = new Date()) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  const end = monthEnd > now ? now : monthEnd;
  return {
    month,
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    start,
    end,
    partial: monthEnd > now,
    label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

export function isMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "");
}

export function recentMonths(count = 12, now = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

const within = (iso, r) => iso && new Date(iso) >= r.start && new Date(iso) <= r.end;
const metric = (metrics, type) => metrics?.find((m) => m.type === type)?.value ?? null;

/** The snapshot nearest the end of the range (at or before it), and the one nearest its start. */
function bracket(snaps, r) {
  const upTo = snaps.filter((s) => new Date(s.createdAt) <= r.end);
  const end = upTo.at(-1) || null;
  const start = upTo.filter((s) => new Date(s.createdAt) >= r.start)[0] || null;
  return { start: start && start.id !== end?.id ? start : null, end };
}

async function settle(promise) {
  try {
    return await promise;
  } catch (error) {
    console.error("[reports]", error.message);
    return null;
  }
}

async function websiteForMonth(r) {
  if (!(await websiteConfigured())) return { configured: false };
  const { siteUrl } = await websiteConfig();
  const { value } = await cached(`report-website-${siteUrl}-${r.month}-${r.to}`, 3 * 3600000, async () => {
    const [summary, traffic, queries, pages] = await Promise.all([
      getReportSummary(r).catch(() => null),
      getTrafficReport(r).catch(() => null),
      getSearchQueries({ ...r, limit: 50 }).catch(() => null),
      getPagesReport({ ...r, limit: 10 }).catch(() => null),
    ]);
    return { summary, traffic, queries, pages };
  });
  return { configured: true, ...value };
}

export async function reportData(month) {
  const r = monthRange(month);
  const [website, social, jobs, ideas, overview, profiles, backlinks, ai, usage] = await Promise.all([
    settle(websiteForMonth(r)),
    settle(analytics({ start: r.start.toISOString(), end: r.end.toISOString() })),
    settle(listJobs()),
    settle(listIdeas()),
    settle(history("overview", "all", 60)),
    settle(history("profiles", "all", 60)),
    settle(history("backlinks", "all", 60)),
    settle(history("ai", "all", 60)),
    settle(collection("dataforseo_usage").find({ month })),
  ]);

  const allJobs = jobs || [];
  const aiRuns = allJobs.flatMap((j) => (j.aiRuns || []).filter((run) => within(run.at, r)));
  const ov = bracket(overview || [], r);
  const ours = (snap) => snap?.data?.find((d) => d.you) || null;

  return {
    range: { month: r.month, from: r.from, to: r.to, label: r.label, partial: r.partial },
    website: website?.configured
      ? {
          kpis: website.summary?.kpis || null,
          narrative: website.summary?.narrative || null,
          channels: website.traffic?.channels || [],
          socialReferrals: socialReferrals(website.traffic),
          queries: website.queries?.rows || [],
          landingPages: website.pages?.landing || [],
        }
      : null,
    social: social && {
      simulated: social.simulated,
      totals: { posts: social.posts.length, impressions: metric(social.totals, "impressions"), reactions: metric(social.totals, "reactions"), comments: metric(social.totals, "comments"), clicks: metric(social.totals, "clicks") },
      perChannel: social.perChannel.map((c) => ({ service: c.channel.service, name: c.channel.name, posts: c.postCount, impressions: metric(c.metrics, "impressions"), engagementRate: metric(c.metrics, "engagementRate") })),
      posts: social.posts.map((p) => ({ service: p.service, sentAt: p.sentAt || p.dueAt, text: p.text, impressions: metric(p.metrics, "impressions"), reactions: metric(p.metrics, "reactions"), comments: metric(p.metrics, "comments") })),
    },
    work: {
      jobsCreated: allJobs.filter((j) => within(j.createdAt, r)).map((j) => ({ id: j.id, title: j.title })),
      caseStudiesSent: allJobs.filter((j) => within(j.website?.sentAt, r)).map((j) => ({ id: j.id, title: j.title, url: j.website?.adminUrl || j.website?.url || null })),
      ideasAdded: (ideas || []).filter((i) => within(i.createdAt, r)).length,
      ideasPublished: (ideas || []).filter((i) => within(i.publishedAt, r)).map((i) => ({ title: i.title, keyword: i.keyword })),
      ideasWaiting: (ideas || []).filter((i) => i.status === "idea" || i.status === "planned").length,
      aiCostUsd: aiRuns.reduce((s, run) => s + (run.costUsd || 0), 0),
      dataCostUsd: (usage || []).reduce((s, u) => s + (u.cost || 0), 0),
    },
    market: ov.end && {
      at: ov.end.createdAt,
      comparedWith: ov.start?.createdAt || null,
      rows: ov.end.data.map((d) => {
        const before = ov.start?.data.find((x) => x.domain === d.domain);
        return { domain: d.domain, you: d.you, traffic: d.traffic, keywords: d.keywords, top10: d.top10, trafficChange: before ? d.traffic - before.traffic : null };
      }),
    },
    reputation: {
      profile: ours(bracket(profiles || [], r).end),
      backlinks: ours(bracket(backlinks || [], r).end),
      ai: ours(bracket(ai || [], r).end) && { mentions: ours(bracket(ai || [], r).end).mentions },
    },
  };
}

export async function savedSummary(month) {
  try {
    const [doc] = await reports().find({ month }, { sort: { createdAt: -1 }, limit: 1 });
    return doc || null;
  } catch {
    return null;
  }
}

/** AI executive summary of a month, stored so the report reads the same next time. */
export async function writeSummary(month, user) {
  const data = await reportData(month);
  const { summary, run } = await generateReportSummary(forAi(data));
  return reports().insert({ month, ...summary, run, createdBy: user?.email || null });
}

function forAi(data) {
  return {
    ...data,
    social: data.social && { ...data.social, posts: data.social.posts.slice(0, 30).map((p) => ({ ...p, text: p.text.slice(0, 140) })) },
    website: data.website && { ...data.website, queries: data.website.queries.slice(0, 30) },
  };
}

/* --- CSV ------------------------------------------------------------------ */

const cell = (v) => {
  if (v == null) return "";
  const s = String(v);
  // Quote when needed; neutralise spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(headers, rows) {
  return [headers.map((h) => cell(h.label)).join(","), ...rows.map((row) => headers.map((h) => cell(row[h.key])).join(","))].join("\r\n") + "\r\n";
}

export const CSV_KINDS = {
  kpis: "Headline numbers",
  posts: "Social posts",
  queries: "Search queries",
  competitors: "Competitors",
  work: "Work shipped",
};

export function csvFor(kind, data) {
  if (kind === "kpis") {
    const k = data.website?.kpis || {};
    const rows = [
      ...Object.entries(k).map(([key, v]) => ({ metric: KPI_LABELS[key] || key, value: v?.now, previous: v?.previous, change: v?.change })),
      { metric: "Social posts published", value: data.social?.totals.posts },
      { metric: "Social impressions", value: data.social?.totals.impressions },
      { metric: "Social reactions", value: data.social?.totals.reactions },
      { metric: "Jobs created", value: data.work.jobsCreated.length },
      { metric: "Case studies sent", value: data.work.caseStudiesSent.length },
      { metric: "Google rating", value: data.reputation.profile?.rating },
      { metric: "Google reviews", value: data.reputation.profile?.reviews },
      { metric: "Referring domains", value: data.reputation.backlinks?.referringDomains },
      { metric: "AI cost (USD)", value: data.work.aiCostUsd.toFixed(4) },
      { metric: "DataForSEO cost (USD)", value: data.work.dataCostUsd.toFixed(4) },
    ];
    return toCsv([{ key: "metric", label: "Metric" }, { key: "value", label: data.range.label }, { key: "previous", label: "Previous period" }, { key: "change", label: "Change" }], rows);
  }
  if (kind === "posts") {
    return toCsv(
      [{ key: "sentAt", label: "Sent" }, { key: "service", label: "Channel" }, { key: "impressions", label: "Impressions" }, { key: "reactions", label: "Reactions" }, { key: "comments", label: "Comments" }, { key: "text", label: "Text" }],
      data.social?.posts || []
    );
  }
  if (kind === "queries") {
    return toCsv(
      [{ key: "key", label: "Query" }, { key: "clicks", label: "Clicks" }, { key: "impressions", label: "Impressions" }, { key: "ctr", label: "CTR" }, { key: "position", label: "Position" }],
      data.website?.queries || []
    );
  }
  if (kind === "competitors") {
    return toCsv(
      [{ key: "domain", label: "Domain" }, { key: "traffic", label: "Est. traffic/mo" }, { key: "trafficChange", label: "Change in month" }, { key: "keywords", label: "Keywords" }, { key: "top10", label: "Top 10" }],
      data.market?.rows || []
    );
  }
  if (kind === "work") {
    return toCsv(
      [{ key: "type", label: "Type" }, { key: "title", label: "Title" }],
      [
        ...data.work.jobsCreated.map((j) => ({ type: "Job created", title: j.title })),
        ...data.work.caseStudiesSent.map((j) => ({ type: "Case study sent", title: j.title })),
        ...data.work.ideasPublished.map((i) => ({ type: "Idea published", title: i.title })),
      ]
    );
  }
  throw new Error("Unknown export.");
}
