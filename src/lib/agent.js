/**
 * The growth check: runs a chosen set of checks across everything the tool
 * knows (connections, posting targets, approvals, case studies, pipeline,
 * leads, search, traffic, social, market and reputation), then writes one
 * focus brief and a checklist that carries over between runs.
 *
 * Free checks only read data the tool already has. Paid checks refresh
 * DataForSEO data first (estimated from the last real cost when there is
 * one). The AI brief is optional; without it the brief is built by rules.
 */

import { generateFocusBrief } from "@/lib/ai";
import { completeness } from "@/lib/case-study-fields";
import { needsApproval } from "@/lib/content";
import { growthData } from "@/lib/growth";
import { listIdeas } from "@/lib/ideas";
import { listJobs, readyToSchedule, searchConsoleData } from "@/lib/jobs";
import { dueFollowUps, listLeads } from "@/lib/leads";
import { estimateCost, gatewayModels, getActiveModel } from "@/lib/models";
import { dataforseoConfigured, monthlyBudget, monthSpend } from "@/lib/seo/dataforseo";
import { getMarketSettings, history, latest, refreshGap, refreshIdeas, refreshOverview, refreshRankedKeywords } from "@/lib/seo/market";
import { collectTasks, refreshAudit, refreshAiVisibility, refreshBacklinks, refreshMentions, refreshProfiles, requestReviews } from "@/lib/seo/presence";
import { setupStatus } from "@/lib/setup";
import { collection } from "@/lib/store";
import { targetsData } from "@/lib/targets";
import { formatNumber } from "@/lib/ui-labels";

const runs = () => collection("agent_runs");
const items = () => collection("focus_items");
const DAY = 864e5;
const ageDays = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);

const f = (key, severity, title, detail, href) => ({ key, severity, title, detail, href: href || null });

/* --- Free checks --------------------------------------------------------- */

async function checkConnections() {
  const setup = await setupStatus();
  const findings = setup.filter((s) => !s.done).map((s) => f(`connect-${s.id}`, s.id === "storage" || s.id === "auth" ? "high" : "medium", `Connect ${s.label}`, `${s.detail} ${s.fix}`.trim(), "/settings"));
  return { headline: findings.length ? `${findings.length} of ${setup.length} connections need attention` : "Everything is connected", findings };
}

async function checkTargets() {
  const t = await targetsData();
  const findings = t.actions.map((a) => f(`targets-${a.id}`, a.severity, a.title, a.detail, a.kind === "approve" ? `/jobs/${a.jobId}` : a.kind === "idea" ? `/jobs/new?idea=${a.ideaId}` : "/calendar"));
  const week = t.services.map((s) => `${s.service} ${s.periods.week.covered}/${s.periods.week.target}`).join(" · ");
  return { headline: `This week: ${week}`, findings, metrics: { week: t.services.map((s) => ({ service: s.service, ...s.periods.week })) } };
}

async function checkWork() {
  const jobs = await listJobs();
  const findings = [];
  for (const j of jobs) {
    const waiting = needsApproval(j);
    if (waiting.length) findings.push(f(`approve-${j.id}`, "medium", `Approve “${j.title}”`, `${waiting.length} part${waiting.length > 1 ? "s are" : " is"} written and waiting: nothing goes out until approved.`, `/jobs/${j.id}`));
    const cs = j.content?.caseStudy;
    if (cs && !j.website?.projectId) {
      const c = completeness(cs);
      if (j.approvals?.caseStudy && !c.required.length) findings.push(f(`send-${j.id}`, "medium", `Send “${j.title}” to the website`, "The case study is approved but not on the website yet.", `/jobs/${j.id}`));
      else if (c.percent < 70) findings.push(f(`complete-${j.id}`, "low", `Finish the case study for “${j.title}”`, `${c.percent}% complete. Missing: ${[...c.required, ...c.recommended].slice(0, 4).map((m) => m.label).join(", ")}.`, `/jobs/${j.id}`));
    }
  }
  const ready = await readyToSchedule();
  // Drafts from ideas aren't finished work: they don't count as new jobs.
  const recent = jobs.filter((j) => j.kind !== "idea" && ageDays(j.createdAt) <= 30).length;
  if (recent === 0) findings.push(f("no-new-jobs", "high", "No new jobs in 30 days", "Content runs on real jobs. Add one with photos and a short write-up — it becomes posts, a case study and search content.", "/jobs/new"));
  return { headline: `${recent} new job${recent === 1 ? "" : "s"} in 30 days · ${ready.length} approved post${ready.length === 1 ? "" : "s"} ready`, findings };
}

async function checkPipeline() {
  const ideas = await listIdeas();
  const open = ideas.filter((i) => i.status === "idea" || i.status === "planned");
  const findings = [];
  if (!ideas.length) findings.push(f("pipeline-empty", "medium", "The content pipeline is empty", "Add ideas from keyword gaps, keyword demand or AI questions, or press Suggest ideas.", "/ideas"));
  const overdue = ideas.filter((i) => i.dueDate && i.dueDate < new Date().toISOString().slice(0, 10) && i.status !== "published");
  for (const i of overdue.slice(0, 5)) findings.push(f(`idea-overdue-${i.id}`, "medium", `Overdue: “${i.title}”`, `Was due ${i.dueDate}.`, "/ideas"));
  const strong = open.filter((i) => (i.score ?? 0) >= 65 && !i.jobId).slice(0, 3);
  for (const i of strong) findings.push(f(`idea-start-${i.id}`, "low", `Start “${i.title}”`, `High-scoring idea${i.keyword ? ` targeting “${i.keyword}”${i.volume ? ` (${formatNumber(i.volume)}/mo)` : ""}` : ""}, not started.`, `/jobs/new?idea=${i.id}`));
  return { headline: `${open.length} ideas waiting · ${ideas.filter((i) => i.status === "published").length} published`, findings };
}

async function checkLeads() {
  const leads = await listLeads();
  const due = dueFollowUps(leads);
  const findings = due.slice(0, 8).map((l) => f(`followup-${l.id}`, "high", `Follow up ${l.name}`, `Follow-up was due ${l.nextFollowUp}.`, `/leads/${l.id}`));
  const drafts = leads.filter((l) => (l.drafts || []).some((d) => !d.sentAt && !d.approved));
  if (drafts.length) findings.push(f("lead-drafts", "medium", `${drafts.length} outreach draft${drafts.length > 1 ? "s" : ""} to approve`, drafts.slice(0, 3).map((l) => l.name).join(", "), "/leads"));
  const stale = leads.filter((l) => l.status === "new" && ageDays(l.createdAt) > 7);
  if (stale.length) findings.push(f("lead-stale", "low", `${stale.length} lead${stale.length > 1 ? "s" : ""} not contacted after a week`, "Write to them or mark them lost so the pipeline stays honest.", "/leads?stage=new"));
  return { headline: `${leads.filter((l) => !["won", "lost"].includes(l.status)).length} open leads · ${due.length} follow-ups due`, findings };
}

async function checkSearch() {
  const gsc = await searchConsoleData({ refresh: true });
  if (!gsc) return { skipped: "Website not connected — no Search Console data." };
  const rows = gsc.rows || [];
  const findings = [];
  const wins = rows.filter((r) => r.position > 3.5 && r.position <= 20 && r.impressions >= 50).sort((a, b) => b.impressions - a.impressions).slice(0, 4);
  for (const r of wins) findings.push(f(`gsc-win-${r.key}`, "medium", `Quick win: “${r.key}”`, `Position ${r.position.toFixed(1)} with ${formatNumber(r.impressions)} impressions in 90 days. A case study on it, linked to the ranking page, can lift it onto page 1.`, "/keywords?tab=search"));
  const drops = rows.filter((r) => r.positionChange != null && r.positionChange < -3 && r.impressions >= 30).slice(0, 3);
  for (const r of drops) findings.push(f(`gsc-drop-${r.key}`, "high", `Dropped: “${r.key}”`, `Down ${Math.abs(r.positionChange).toFixed(1)} places to ${r.position.toFixed(1)}. Check the ranking page still matches the search, and refresh it.`, "/keywords?tab=search"));
  const lowCtr = rows.filter((r) => r.position <= 3 && r.impressions >= 100 && (r.ctr ?? 1) < 0.03).slice(0, 2);
  for (const r of lowCtr) findings.push(f(`gsc-ctr-${r.key}`, "medium", `Top 3 but few clicks: “${r.key}”`, `CTR ${((r.ctr || 0) * 100).toFixed(1)}%. Rewrite the page's title tag and meta description to win the click.`, "/keywords?tab=search"));
  return { headline: `${formatNumber(gsc.totalQueries ?? rows.length)} search queries · ${wins.length} quick wins`, findings };
}

async function checkPerformance() {
  const data = await growthData({ days: 30, refresh: true });
  const findings = [];
  const k = data.website?.summary?.kpis || {};
  const notes = [];
  for (const [id, label, invert] of [["enquiries", "Enquiries"], ["gscClicks", "Organic search clicks"], ["users", "Website users"], ["gscPosition", "Average search position", true]]) {
    const kpi = k[id];
    if (kpi?.change == null) continue;
    notes.push(`${label} ${kpi.change > 0 ? "+" : ""}${Math.round(kpi.change)}%`);
    const bad = invert ? kpi.change > 10 : kpi.change < -15;
    if (bad) findings.push(f(`kpi-${id}`, id === "enquiries" ? "high" : "medium", `${label} ${invert ? "worse" : "down"} ${Math.abs(Math.round(kpi.change))}% on the previous 30 days`, `Now ${formatNumber(kpi.now)}, was ${formatNumber(kpi.previous)}.`, "/analytics"));
  }
  if (data.website?.error) findings.push(f("website-reports", "medium", "Website reports aren't loading", data.website.error, "/settings"));
  const s = data.social;
  if (s && !s.simulated) {
    const sent = s.posts.length;
    if (sent === 0) findings.push(f("social-none", "high", "Nothing published through Buffer in 30 days", "Schedule approved posts from the calendar — Buffer only reports what it publishes.", "/calendar"));
    notes.push(`${sent} posts published`);
  }
  return { headline: notes.join(" · ") || "No performance data yet", findings };
}

async function checkMarket() {
  const settings = await getMarketSettings();
  const findings = [];
  const stale = [];
  const sections = [
    ["overview", "all", "competitor visibility", "/keywords?tab=competitors"],
    ["ranked", settings.domain, "your rankings", "/keywords?tab=keywords"],
    ["ideas", "all", "keyword demand", "/keywords?tab=keywords"],
    ["profiles", "all", "Google Business profiles", "/reputation"],
    ["backlinks", "all", "backlinks", "/reputation?tab=links"],
    ["audit", "all", "page health", "/reputation?tab=health"],
  ];
  const snaps = {};
  for (const [section, key, label] of sections) {
    snaps[section] = await latest(section, key);
    const age = ageDays(snaps[section]?.createdAt);
    if (age == null || age > 30) stale.push(age == null ? `${label} (never)` : `${label} (${age} days)`);
  }
  if (stale.length) findings.push(f("market-stale", "low", `${stale.length} market data sets are old or missing`, `${stale.join(", ")}. Tick the paid refreshes to update them.`, "/focus"));

  // Competitors: who is growing, and are we losing keywords?
  const hist = await history("overview", "all", 6);
  if (hist.length >= 2) {
    const [prev, last] = [hist.at(-2), hist.at(-1)];
    const growth = last.data
      .map((d) => ({ ...d, before: prev.data.find((x) => x.domain === d.domain)?.traffic }))
      .filter((d) => d.before > 0)
      .map((d) => ({ ...d, change: (d.traffic - d.before) / d.before }));
    const rival = growth.filter((d) => !d.you).sort((a, b) => b.change - a.change)[0];
    if (rival && rival.change > 0.15) findings.push(f(`rival-growth-${rival.domain}`, "medium", `${rival.domain} grew ${Math.round(rival.change * 100)}%`, `Estimated organic traffic ${formatNumber(rival.before)} → ${formatNumber(rival.traffic)}. See what they rank for that you don't.`, `/keywords?tab=competitors&c=${encodeURIComponent(rival.domain)}`));
    const us = growth.find((d) => d.you);
    if (us && us.change < -0.1) findings.push(f("our-visibility-down", "high", `Your estimated search traffic fell ${Math.abs(Math.round(us.change * 100))}%`, `${formatNumber(us.before)} → ${formatNumber(us.traffic)} between the last two snapshots.`, "/keywords?tab=competitors"));
  }
  const ours = snaps.overview?.data?.find((d) => d.you);
  if (ours && ours.lostKeywords > ours.newKeywords + 5) findings.push(f("keywords-lost", "medium", `Losing more keywords than you gain`, `${ours.lostKeywords} lost vs ${ours.newKeywords} new.`, "/keywords?tab=keywords"));

  // Gaps not yet in the pipeline.
  const ideas = await listIdeas();
  const inPipeline = new Set(ideas.map((i) => i.keyword).filter(Boolean));
  const gaps = await collection("market_snapshots").find({ section: "gap" }, { sort: { createdAt: -1 }, limit: 3 }).catch(() => []);
  const gapRows = gaps.flatMap((g) => g.data.map((r) => ({ ...r, competitor: g.key })));
  const best = gapRows.filter((r) => ["commercial", "transactional"].includes(r.intent) && (r.difficulty ?? 100) < 45 && !inPipeline.has(r.keyword)).sort((a, b) => b.score - a.score).slice(0, 3);
  for (const r of best) findings.push(f(`gap-${r.keyword}`, "medium", `Gap: “${r.keyword}” (${formatNumber(r.volume)}/mo)`, `${r.competitor} ranks for it; you don't. Buying intent, difficulty ${r.difficulty}. Add it to the pipeline and write a case study around it.`, `/keywords?tab=competitors&c=${encodeURIComponent(r.competitor)}#gap`));

  // Reputation.
  const reviews = await latest("reviews", "google");
  const unanswered = (reviews?.data?.reviews || []).filter((r) => !r.replied && (r.rating ?? 5) <= 3);
  if (unanswered.length) findings.push(f("reviews-unanswered", "high", `${unanswered.length} low Google review${unanswered.length > 1 ? "s" : ""} without a reply`, "Buyers read the replies. Answer calmly with the facts.", "/reputation"));
  const profiles = snaps.profiles?.data || [];
  const me = profiles.find((p) => p.you);
  const topRival = profiles.filter((p) => !p.you && p.found).sort((a, b) => b.reviews - a.reviews)[0];
  if (me && topRival && topRival.reviews > me.reviews * 1.5) findings.push(f("reviews-behind", "medium", `${topRival.title || topRival.name} has ${topRival.reviews} Google reviews to your ${me.reviews}`, "Ask every happy client for a review at handover — add the link to the O&M handover email.", "/reputation"));
  const pages = snaps.audit?.data || [];
  const serious = pages.filter((p) => p.issues?.some((i) => i.severity === "high"));
  if (serious.length) findings.push(f("audit-serious", "high", `${serious.length} key page${serious.length > 1 ? "s have" : " has"} serious issues`, serious.slice(0, 2).map((p) => `${p.url.replace(/^https:\/\/(www\.)?/, "")}: ${p.issues.filter((i) => i.severity === "high").map((i) => i.label).join(", ")}`).join("; "), "/reputation?tab=health"));
  const links = snaps.backlinks?.data || [];
  const myLinks = links.find((l) => l.you);
  const rivalsLinks = links.filter((l) => !l.you).map((l) => l.referringDomains).sort((a, b) => a - b);
  if (myLinks && rivalsLinks.length && myLinks.referringDomains < rivalsLinks[Math.floor(rivalsLinks.length / 2)]) findings.push(f("links-behind", "medium", "Fewer sites link to you than to most competitors", `${myLinks.referringDomains} referring domains vs a competitor median of ${rivalsLinks[Math.floor(rivalsLinks.length / 2)]}. Work the link prospects list.`, "/reputation?tab=links"));
  const ai = await latest("ai");
  const aiMe = ai?.data?.rows?.find((r) => r.you);
  const aiBest = ai?.data?.rows?.filter((r) => !r.you).sort((a, b) => b.mentions - a.mentions)[0];
  if (aiMe && aiBest && aiBest.mentions > aiMe.mentions) findings.push(f("ai-behind", "medium", `AI answers mention ${aiBest.domain} more than you`, `${aiBest.mentions} mentions vs your ${aiMe.mentions}. Get listed on the sites AI cites, and answer buyer questions in case studies.`, "/reputation?tab=ai"));

  return { headline: `${findings.length} market and reputation findings`, findings };
}

/* --- Paid refreshes ------------------------------------------------------ */

const lastCost = async (section, key = "all") => {
  const s = await latest(section, key);
  return s?.cost ?? null;
};

export const CHECKS = [
  { id: "connections", group: "free", label: "Connections", description: "Database, AI, Buffer, website, sign-in.", run: checkConnections },
  { id: "targets", group: "free", label: "Posting targets", description: "Today, this week and the month against your publishing days.", run: checkTargets },
  { id: "work", group: "free", label: "Jobs, approvals & case studies", description: "Waiting approvals, case studies to finish or send, new jobs.", run: checkWork },
  { id: "pipeline", group: "free", label: "Content pipeline", description: "Overdue and high-scoring ideas not started.", run: checkPipeline },
  { id: "leads", group: "free", label: "Leads & follow-ups", description: "Follow-ups due, drafts to approve, leads gone quiet.", run: checkLeads },
  { id: "search", group: "free", label: "Search Console", description: "Quick wins, drops and low click-through from your website's data.", run: checkSearch },
  { id: "performance", group: "free", label: "Traffic, enquiries & social", description: "30 days vs the previous 30.", run: checkPerformance },
  { id: "market", group: "free", label: "Market & reputation review", description: "Reads your stored competitor, keyword, review, link and page data. Tick refreshes below to update it first.", run: checkMarket },
  { id: "refresh-visibility", group: "paid", label: "Refresh competitor visibility", description: "Traffic and keywords for you and tracked competitors.", estimate: async () => (await lastCost("overview")) ?? 0.011 * (1 + (await getMarketSettings()).competitors.length), run: () => refreshOverview() },
  { id: "refresh-rankings", group: "paid", label: "Refresh your rankings", description: "Your top 200 keywords and positions.", estimate: async () => (await lastCost("ranked", (await getMarketSettings()).domain)) ?? 0.03, run: async () => refreshRankedKeywords((await getMarketSettings()).domain) },
  { id: "refresh-ideas", group: "paid", label: "Refresh keyword demand", description: "UK searches around your services.", estimate: async () => (await lastCost("ideas")) ?? 0.06, run: () => refreshIdeas() },
  {
    id: "refresh-gap",
    group: "paid",
    label: "Refresh keyword gap",
    description: "What your first tracked competitor ranks for and you don't.",
    estimate: async () => {
      const c = (await getMarketSettings()).competitors[0];
      return c ? ((await lastCost("gap", c)) ?? 0.03) : 0;
    },
    run: async () => {
      const c = (await getMarketSettings()).competitors[0];
      if (!c) throw new Error("Track a competitor first.");
      return refreshGap(c);
    },
  },
  {
    id: "refresh-reputation",
    group: "paid",
    label: "Refresh Google profile & reviews",
    description: "Profiles vs rivals now; new reviews arrive a few minutes later.",
    estimate: async () => ((await lastCost("profiles")) ?? 0.006 * (1 + (await getMarketSettings()).rivals.length)) + 0.02,
    run: async () => {
      await collectTasks();
      const p = await refreshProfiles();
      const r = await requestReviews("google");
      return { cost: (p.cost || 0) + (r.cost || 0) };
    },
  },
  { id: "refresh-backlinks", group: "paid", label: "Refresh backlinks", description: "Authority and referring domains vs competitors.", estimate: async () => (await lastCost("backlinks")) ?? 0.02 * (1 + Math.min(6, (await getMarketSettings()).competitors.length)), run: () => refreshBacklinks() },
  { id: "refresh-audit", group: "paid", label: "Check key pages", description: "Titles, headings, speed and broken basics on up to 10 pages.", estimate: async () => (await lastCost("audit")) ?? 0.01, run: () => refreshAudit() },
  { id: "refresh-mentions", group: "paid", label: "Refresh brand mentions", description: "Where your name appears online, and the tone.", estimate: async () => (await lastCost("mentions")) ?? 0.04, run: () => refreshMentions() },
  { id: "refresh-ai", group: "paid", label: "Refresh AI answer visibility", description: "Mentions in Google AI and ChatGPT vs up to 3 competitors — the dearest check.", estimate: async () => (await lastCost("ai")) ?? 0.1 * (1 + 2 * (1 + Math.min(3, (await getMarketSettings()).competitors.length))), run: () => refreshAiVisibility() },
];

export const PRESETS = {
  free: { label: "Free checks", checks: CHECKS.filter((c) => c.group === "free").map((c) => c.id) },
  weekly: { label: "Weekly (recommended)", checks: [...CHECKS.filter((c) => c.group === "free").map((c) => c.id), "refresh-visibility", "refresh-rankings", "refresh-reputation"] },
  everything: { label: "Everything", checks: CHECKS.map((c) => c.id) },
};

const TYPICAL_BRIEF = { inputTokens: 9000, outputTokens: 2500 };

/** Every check with its cost estimate, plus the AI brief and the budget. */
export async function catalogue() {
  const configured = dataforseoConfigured();
  const lastRuns = await runs().find({}, { sort: { createdAt: -1 }, limit: 20 }).catch(() => []);
  const lastFor = (id) => lastRuns.find((r) => r.results?.[id] && !r.results[id].skipped)?.createdAt || null;
  const checks = await Promise.all(
    CHECKS.map(async (c) => {
      let estimate = 0;
      if (c.group === "paid") estimate = configured ? await c.estimate().catch(() => null) : null;
      return { id: c.id, group: c.group, label: c.label, description: c.description, estimate, available: c.group === "free" || configured, lastRun: lastFor(c.id) };
    })
  );
  let ai = { available: Boolean(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN), model: null, estimate: null };
  try {
    ai.model = await getActiveModel();
    const m = (await gatewayModels()).find((x) => x.id === ai.model);
    ai.estimate = m ? estimateCost(m, TYPICAL_BRIEF) : null;
  } catch {}
  const [spent, budget] = configured ? [await monthSpend().catch(() => null), monthlyBudget()] : [null, null];
  return { checks, ai, budget: configured ? { spent, budget, left: spent == null ? null : Math.max(0, budget - spent) } : null, presets: PRESETS };
}

/* --- Runs ---------------------------------------------------------------- */

export async function startRun({ checks, useAi, user, trigger = "manual" }) {
  const valid = checks.filter((id) => CHECKS.some((c) => c.id === id));
  if (!valid.length) throw new Error("Pick at least one check.");
  // Refreshes first, so the review reads fresh data.
  valid.sort((a, b) => (CHECKS.find((c) => c.id === a).group === "paid" ? 0 : 1) - (CHECKS.find((c) => c.id === b).group === "paid" ? 0 : 1));
  return runs().insert({ checks: valid, useAi: Boolean(useAi), status: "running", results: {}, cost: 0, trigger, createdBy: user?.email || null });
}

export async function getRun(id) {
  return runs().get(id);
}

export async function listRuns(limit = 10) {
  return runs().find({}, { sort: { createdAt: -1 }, limit }).catch(() => []);
}

/** Run one check of a run and store its result. */
export async function runCheck(runId, checkId) {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");
  if (!run.checks.includes(checkId)) throw new Error("That check isn't part of this run.");
  const check = CHECKS.find((c) => c.id === checkId);
  const started = Date.now();
  let result;
  try {
    if (check.group === "paid" && !dataforseoConfigured()) {
      result = { status: "skipped", headline: "DataForSEO isn't connected.", findings: [] };
    } else {
      const out = await check.run();
      if (check.group === "paid") {
        result = { status: "ok", headline: "Refreshed.", findings: [], cost: Number(out?.cost) || 0 };
      } else if (out.skipped) {
        result = { status: "skipped", headline: out.skipped, findings: [] };
      } else {
        const high = out.findings.filter((x) => x.severity === "high").length;
        result = { status: high ? "bad" : out.findings.length ? "warn" : "ok", headline: out.headline, findings: out.findings, metrics: out.metrics || null };
      }
    }
  } catch (error) {
    result = { status: "error", headline: error.message, findings: [] };
  }
  result = { ...result, label: check.label, group: check.group, ms: Date.now() - started };
  const fresh = await getRun(runId);
  const results = { ...fresh.results, [checkId]: result };
  await runs().update(runId, { results, cost: Object.values(results).reduce((s, r) => s + (r.cost || 0), 0) });
  return result;
}

/** 100 minus weighted findings; skipped and failed checks don't count. */
export function scoreFindings(findings) {
  const weight = { high: 8, medium: 3, low: 1 };
  return Math.max(0, Math.min(100, 100 - findings.reduce((s, x) => s + (weight[x.severity] || 0), 0)));
}

/** Rules-only brief (used when AI is off or fails). */
export function ruleBrief(findings) {
  const order = { high: 0, medium: 1, low: 2 };
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
  const score = scoreFindings(findings);
  const high = sorted.filter((x) => x.severity === "high");
  return {
    score,
    headline: high.length ? `${high.length} urgent: ${high.slice(0, 2).map((x) => x.title).join("; ")}` : findings.length ? `No urgent issues — ${findings.length} improvements to make` : "Nothing needs attention",
    summary: findings.length ? `Found ${findings.length} things: ${high.length} urgent, ${findings.filter((x) => x.severity === "medium").length} worth doing this week, ${findings.filter((x) => x.severity === "low").length} when there's time.` : "Every check passed.",
    focus: sorted.slice(0, 3).map((x) => ({ title: x.title, why: x.detail })),
    checklist: sorted.slice(0, 15).map((x) => ({ key: x.key, title: x.title, why: x.detail, impact: x.severity, effort: null, href: x.href })),
  };
}

/** Merge a brief's checklist into the standing checklist (by key). */
export async function mergeChecklist(runId, checklist) {
  const existing = await items().find({});
  const byKey = new Map(existing.map((i) => [i.key, i]));
  const now = new Date().toISOString();
  for (const c of checklist) {
    const old = byKey.get(c.key);
    if (!old) {
      await items().insert({ ...c, status: "open", runId, firstSeen: now, lastSeen: now, recurred: false });
    } else {
      const reopen = old.status === "done";
      await items().update(old.id, { title: c.title, why: c.why, impact: c.impact, effort: c.effort ?? old.effort, href: c.href, runId, lastSeen: now, ...(reopen && { status: "open", recurred: true }) });
    }
  }
}

export async function finishRun(runId) {
  const run = await getRun(runId);
  if (!run) throw new Error("Run not found.");
  const findings = Object.entries(run.results).flatMap(([check, r]) => (r.findings || []).map((x) => ({ ...x, check })));
  let brief = null;
  let briefRun = null;
  let briefError = null;
  if (run.useAi && findings.length) {
    try {
      const out = await generateFocusBrief({ findings, checks: Object.fromEntries(Object.entries(run.results).map(([k, r]) => [k, { status: r.status, headline: r.headline }])) });
      const keys = new Set(findings.map((x) => x.key));
      const checklist = out.brief.checklist.filter((c) => keys.has(c.key)).map((c) => ({ ...c, href: findings.find((x) => x.key === c.key)?.href || null }));
      // Items must come from real findings; if none survive, rank by rules.
      brief = { ...out.brief, score: scoreFindings(findings), checklist: checklist.length ? checklist : ruleBrief(findings).checklist };
      briefRun = out.run;
    } catch (error) {
      briefError = error.message;
    }
  }
  if (!brief) brief = ruleBrief(findings);
  await mergeChecklist(runId, brief.checklist);
  return runs().update(runId, { status: "done", brief, briefRun, briefError, cost: (run.cost || 0), aiCost: briefRun?.costUsd ?? 0, findingsCount: findings.length, finishedAt: new Date().toISOString() });
}

/** Whole run on the server (the weekly automatic run). */
export async function runAll({ checks, useAi, trigger = "schedule" }) {
  const run = await startRun({ checks, useAi, trigger });
  for (const id of run.checks) await runCheck(run.id, id);
  return finishRun(run.id);
}

/* --- Checklist ----------------------------------------------------------- */

export async function listChecklist() {
  return items().find({}, { sort: { lastSeen: -1 } }).catch(() => []);
}

export async function updateItem(id, patch, user) {
  const next = { ...patch };
  if (patch.status === "done") Object.assign(next, { doneBy: user?.email || null, doneAt: new Date().toISOString(), recurred: false });
  if (patch.status === "open") Object.assign(next, { doneBy: null, doneAt: null });
  return items().update(id, next);
}

export async function addItem({ title, why }, user) {
  const now = new Date().toISOString();
  return items().insert({ key: `manual-${Date.now()}`, title, why: why || "", impact: "medium", href: null, status: "open", manual: true, createdBy: user?.email || null, firstSeen: now, lastSeen: now });
}

export async function deleteItem(id) {
  return items().remove(id);
}

/* --- Automatic weekly run ------------------------------------------------ */

const settings = () => collection("settings");

export async function getAgentSchedule() {
  const [doc] = await settings().find({ key: "agent-schedule" }).catch(() => []);
  return doc?.value || { enabled: false, preset: "weekly", useAi: true };
}

export async function setAgentSchedule(value, user) {
  const clean = { enabled: Boolean(value.enabled), preset: PRESETS[value.preset] ? value.preset : "weekly", useAi: value.useAi !== false };
  const [doc] = await settings().find({ key: "agent-schedule" });
  if (doc) await settings().update(doc.id, { value: clean, updatedBy: user?.email || null });
  else await settings().insert({ key: "agent-schedule", value: clean, updatedBy: user?.email || null });
  return clean;
}
