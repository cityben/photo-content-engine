/**
 * Reputation and authority from DataForSEO: Google Business profiles and
 * reviews, Trustpilot, brand mentions across the web, mentions in AI answers
 * (ChatGPT, Google AI Overviews), backlinks and a page-level site audit.
 *
 * Same rules as market.js: snapshots are stored, pages read them for free,
 * every refresh is an explicit (paid) action.
 */

import { collection } from "@/lib/store";

import { auditIssues, cleanDomain, linkProspects } from "./analysis";
import { getTask, post, postTask, UK } from "./dataforseo";
import { getMarketSettings, latest } from "./market";

const snapshots = () => collection("market_snapshots");
const tasks = () => collection("market_tasks");

/** DataForSEO times look like "2026-10-01 10:00:00 +00:00". */
const iso = (t) => (t ? String(t).replace(" +00:00", "Z").replace(" ", "T") : null);

const save = (section, key, data, cost) => snapshots().insert({ section, key: key || "all", data, cost });

/* --- Google Business profiles (live) --------------------------------------- */

function profileRow(item, name) {
  const rating = item?.rating || {};
  return {
    name,
    found: Boolean(item),
    title: item?.title || null,
    category: item?.category || null,
    address: item?.address || null,
    phone: item?.phone || null,
    url: item?.url || null,
    rating: rating.value ?? null,
    reviews: rating.votes_count ?? 0,
    distribution: item?.rating_distribution || {},
    topics: Object.entries(item?.place_topics || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count })),
    claimed: item?.is_claimed ?? null,
    photos: item?.total_photos ?? 0,
    cid: item?.cid || null,
    you: false,
  };
}

/** Our Google Business profile next to named local rivals. */
export async function refreshProfiles() {
  const { brand, location, rivals } = await getMarketSettings();
  let cost = 0;
  const rows = [];
  for (const [i, name] of [brand, ...rivals].entries()) {
    const r = await post("/v3/business_data/google/my_business_info/live", { keyword: name, location_name: location, language_code: "en" });
    cost += r.cost;
    const row = profileRow(r.result[0]?.items?.[0], name);
    rows.push({ ...row, you: i === 0 });
  }
  return save("profiles", "all", rows, cost);
}

/* --- Reviews (queued: post a task, collect it a minute later) ------------- */

const REVIEW_SOURCES = {
  google: {
    post: "/v3/business_data/google/reviews/task_post",
    get: (id) => `/v3/business_data/google/reviews/task_get/${id}`,
    task: ({ brand, location }) => ({ keyword: brand, location_name: location, language_code: "en", depth: 150, sort_by: "newest" }),
    normalise: (i) => ({
      rating: i.rating?.value ?? null,
      text: i.review_text || "",
      author: i.profile_name || "Google user",
      date: iso(i.timestamp),
      url: i.review_url || null,
      replied: Boolean(i.owner_answer),
      reply: i.owner_answer || null,
    }),
  },
  trustpilot: {
    post: "/v3/business_data/trustpilot/reviews/task_post",
    get: (id) => `/v3/business_data/trustpilot/reviews/task_get/${id}`,
    task: ({ domain }) => ({ domain: `www.${domain}`, depth: 100, sort_by: "recency" }),
    normalise: (i) => ({
      rating: i.rating?.value ?? null,
      title: i.title || "",
      text: i.review_text || "",
      author: i.user_profile?.name || "Trustpilot user",
      date: iso(i.timestamp),
      url: i.url || null,
      replied: Boolean(i.responses?.length),
      reply: i.responses?.[0]?.review_text || i.responses?.[0]?.text || null,
    }),
  },
};

export async function requestReviews(source) {
  const s = REVIEW_SOURCES[source];
  if (!s) throw new Error("Unknown review source.");
  const settings = await getMarketSettings();
  const { id, cost } = await postTask(s.post, s.task(settings));
  await tasks().insert({ kind: "reviews", source, taskId: id, status: "pending", cost });
  return { cost, data: [], pending: true };
}

export async function pendingTasks() {
  try {
    return await tasks().find({ status: "pending" }, { sort: { createdAt: -1 } });
  } catch {
    return [];
  }
}

/** Check queued tasks; store any that finished. Fetching results is free. */
export async function collectTasks() {
  const pending = await pendingTasks();
  let done = 0;
  for (const t of pending) {
    const s = REVIEW_SOURCES[t.source];
    if (!s) continue;
    try {
      const r = await getTask(s.get(t.taskId));
      if (!r.ready) {
        // DataForSEO keeps results 30 days; give up on a task after a day.
        if (Date.now() - new Date(t.createdAt).getTime() > 864e5) await tasks().update(t.id, { status: "failed", error: "Timed out" });
        continue;
      }
      const res = r.result[0] || {};
      const reviews = (res.items || []).map(s.normalise);
      await save("reviews", t.source, { title: res.title || null, rating: res.rating?.value ?? null, total: Number(res.reviews_count) || reviews.length, reviews }, t.cost || 0);
      await tasks().update(t.id, { status: "done" });
      done += 1;
    } catch (error) {
      await tasks().update(t.id, { status: "failed", error: error.message });
    }
  }
  return { done, pending: pending.length - done };
}

/* --- Brand mentions across the web --------------------------------------- */

export async function refreshMentions() {
  const { brand, domain } = await getMarketSettings();
  const keyword = `"${brand}"`;
  const [search, summary] = await Promise.all([
    post("/v3/content_analysis/search/live", {
      keyword,
      search_mode: "one_per_domain",
      limit: 100,
      order_by: ["content_info.date_published,desc"],
    }),
    post("/v3/content_analysis/summary/live", { keyword, internal_list_limit: 10 }),
  ]);
  const mentions = (search.result[0]?.items || [])
    .filter((i) => cleanDomain(i.main_domain || i.domain) !== domain)
    .map((i) => {
    const c = i.content_info || {};
    const tone = Object.entries(c.connotation_types || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return {
      url: i.url,
      domain: cleanDomain(i.main_domain || i.domain),
      domainRank: i.domain_rank ?? null,
      title: c.main_title || c.title || null,
      snippet: c.snippet || null,
      date: iso(c.date_published || i.fetch_time),
      tone,
      types: i.page_types || [],
    };
    });
  const sum = summary.result[0] || {};
  return save(
    "mentions",
    "all",
    {
      total: sum.total_count ?? mentions.length,
      tones: sum.connotation_types || {},
      emotions: sum.sentiment_connotations || {},
      pageTypes: sum.page_types || {},
      topDomains: (sum.top_domains || []).map((d) => ({ domain: d.domain, count: d.count })),
      mentions,
    },
    search.cost + summary.cost
  );
}

/* --- AI answers: are we mentioned by ChatGPT / Google AI? ----------------- */

/*
 * ChatGPT data exists for the US only, so ChatGPT is checked there and
 * Google's AI Overviews in the UK.
 */
const AI_PLATFORMS = [
  { key: "google", label: "Google AI (UK)", params: { platform: "google", ...UK } },
  { key: "chat_gpt", label: "ChatGPT (US data)", params: { platform: "chat_gpt" } },
];

export async function refreshAiVisibility() {
  const { domain, competitors } = await getMarketSettings();
  const domains = [domain, ...competitors.slice(0, 3)];
  let cost = 0;
  const rows = [];
  for (const d of domains) {
    const row = { domain: d, you: d === domain, mentions: 0, aiSearchVolume: 0, platforms: {}, sources: [] };
    for (const p of AI_PLATFORMS) {
      const r = await post("/v3/ai_optimization/llm_mentions/target_metrics/live", { target: [{ domain: d }], ...p.params, internal_list_limit: 10 });
      cost += r.cost;
      const m = r.result[0]?.aggregated_metrics || {};
      row.platforms[p.key] = m.total?.mentions ?? 0;
      row.mentions += m.total?.mentions ?? 0;
      row.aiSearchVolume += m.total?.ai_search_volume ?? 0;
      if (p.key === "google") row.sources = (m.sources_domain || []).slice(0, 8).map((s) => ({ domain: s.key, mentions: s.mentions }));
    }
    rows.push(row);
  }
  const questions = await post("/v3/ai_optimization/llm_mentions/search_mentions/live", {
    target: [{ domain }],
    platform: "google",
    ...UK,
    limit: 20,
    order_by: ["ai_search_volume,desc"],
  });
  cost += questions.cost;
  const asked = (questions.result[0]?.items || []).map((i) => ({
    question: i.question,
    platform: i.platform,
    volume: i.ai_search_volume ?? 0,
    brands: (i.brand_entities || []).map((b) => b.title).slice(0, 6),
    sources: (i.sources || []).map((s) => cleanDomain(s.domain)).filter(Boolean).slice(0, 6),
  }));
  return save("ai", "all", { platforms: AI_PLATFORMS.map(({ key, label }) => ({ key, label })), rows, questions: asked }, cost);
}

/* --- Backlinks ------------------------------------------------------------- */

export async function refreshBacklinks() {
  const { domain, competitors } = await getMarketSettings();
  let cost = 0;
  const rows = [];
  for (const d of [domain, ...competitors.slice(0, 6)]) {
    const r = await post("/v3/backlinks/summary/live", { target: d, include_subdomains: true, rank_scale: "one_hundred" });
    cost += r.cost;
    const s = r.result[0] || {};
    rows.push({
      domain: d,
      you: d === domain,
      rank: s.rank ?? null,
      backlinks: s.backlinks ?? 0,
      referringDomains: s.referring_main_domains ?? s.referring_domains ?? 0,
      broken: s.broken_backlinks ?? 0,
      spamScore: s.backlinks_spam_score ?? null,
    });
  }
  return save("backlinks", "all", rows, cost);
}

/** Sites linking to two competitors but not to us: the warmest link prospects. */
export async function refreshLinkGap() {
  const { domain, competitors } = await getMarketSettings();
  if (competitors.length < 2) throw new Error("Track at least two competitors first.");
  const targets = Object.fromEntries(competitors.slice(0, 2).map((d, i) => [String(i + 1), d]));
  const { result, cost } = await post("/v3/backlinks/domain_intersection/live", {
    targets,
    exclude_targets: [domain],
    include_subdomains: true,
    limit: 100,
    rank_scale: "one_hundred",
    order_by: ["1.rank,desc"],
  });
  return save("linkgap", "all", { targets: Object.values(targets), prospects: linkProspects(result[0]?.items, targets) }, cost);
}

/* --- Site health: instant page audits ------------------------------------ */

export async function refreshAudit() {
  const { domain, auditUrls } = await getMarketSettings();
  let urls = auditUrls;
  if (!urls.length) {
    const ours = await latest("ranked", domain);
    const top = [...new Set((ours?.data || []).map((r) => r.url).filter(Boolean))].slice(0, 7);
    urls = [`https://www.${domain}/`, ...top.filter((u) => u.replace(/\/$/, "") !== `https://www.${domain}`)].slice(0, 8);
  }
  let cost = 0;
  const pages = [];
  for (const url of urls) {
    try {
      const r = await post("/v3/on_page/instant_pages", { url, enable_browser_rendering: true, load_resources: true });
      cost += r.cost;
      const p = r.result[0]?.items?.[0] || {};
      const meta = p.meta || {};
      pages.push({
        url,
        status: p.status_code ?? null,
        score: p.onpage_score != null ? Math.round(p.onpage_score) : null,
        title: meta.title || null,
        titleLength: meta.title_length ?? null,
        descriptionLength: meta.description_length ?? null,
        h1: meta.htags?.h1?.[0] || null,
        words: meta.content?.plain_text_word_count ?? null,
        images: meta.images_count ?? null,
        lcp: p.page_timing?.largest_contentful_paint != null ? Math.round(p.page_timing.largest_contentful_paint) : null,
        cls: meta.cumulative_layout_shift ?? null,
        issues: auditIssues(p.checks),
      });
    } catch (error) {
      pages.push({ url, error: error.message, issues: [] });
    }
  }
  return save("audit", "all", pages, cost);
}

export const PRESENCE_REFRESHERS = {
  profiles: () => refreshProfiles(),
  "reviews-google": () => requestReviews("google"),
  "reviews-trustpilot": () => requestReviews("trustpilot"),
  collect: async () => ({ cost: 0, data: await collectTasks() }),
  mentions: () => refreshMentions(),
  ai: () => refreshAiVisibility(),
  backlinks: () => refreshBacklinks(),
  linkgap: () => refreshLinkGap(),
  audit: () => refreshAudit(),
};
