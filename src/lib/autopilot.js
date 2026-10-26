/**
 * Autopilot: keeps the content pipeline moving. It can ask the AI planner
 * for fresh ideas, then drafts the best open ideas as "idea" jobs — a blog
 * post, a LinkedIn post and a Google Business post each, written towards the
 * idea's target search — and leaves them in the review queue.
 *
 * Nothing goes out on its own: every draft waits for a person to approve it.
 * Ideas that need a finished job (case studies) are never drafted; there's
 * no work to describe, so they stay on the board for a real job.
 */

import { isIdeaJob, mainImageOf } from "@/lib/content";
import { getIdea, linkJob, listIdeas, targetFromIdea } from "@/lib/ideas";
import { createJob, generateForJob, listJobs } from "@/lib/jobs";
import { averageJobUsage, estimateCost, gatewayModels, getActiveModel } from "@/lib/models";
import { planIdeas } from "@/lib/planner";
import { collection } from "@/lib/store";

export const AUTOPILOT_FORMATS = {
  blog: "Blog post",
  linkedin: "LinkedIn post",
  googleBusiness: "Google Business post",
};

/** Idea formats autopilot can draft without a finished job behind them. */
export const DRAFTABLE = ["article", "service-page", "linkedin", "google-business"];

export const DEFAULT_AUTOPILOT = { enabled: false, perRun: 3, formats: ["blog", "linkedin", "googleBusiness"], plan: true, photos: true };

const settings = () => collection("settings");
const runs = () => collection("autopilot_runs");
const KEY = "autopilot";

export function cleanAutopilot(input = {}) {
  const formats = (Array.isArray(input.formats) ? input.formats : DEFAULT_AUTOPILOT.formats).filter((f) => AUTOPILOT_FORMATS[f]);
  return {
    enabled: Boolean(input.enabled),
    perRun: Math.min(6, Math.max(1, Math.round(Number(input.perRun) || DEFAULT_AUTOPILOT.perRun))),
    formats: formats.length ? [...new Set(formats)] : DEFAULT_AUTOPILOT.formats,
    plan: input.plan !== false,
    photos: input.photos !== false,
  };
}

export async function getAutopilot() {
  const [doc] = await settings().find({ key: KEY }).catch(() => []);
  return doc?.value ? cleanAutopilot({ ...DEFAULT_AUTOPILOT, ...doc.value }) : DEFAULT_AUTOPILOT;
}

export async function setAutopilot(input, user) {
  const value = cleanAutopilot(input);
  const [doc] = await settings().find({ key: KEY });
  if (doc) await settings().update(doc.id, { value, updatedBy: user?.email || null });
  else await settings().insert({ key: KEY, value, updatedBy: user?.email || null });
  return value;
}

/* --- Choosing what to draft ----------------------------------------------- */

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Open ideas autopilot can draft, best first: anything due soonest, then
 * opportunity score, then search volume, then the oldest idea.
 */
export function rankIdeas(ideas, now = today()) {
  return ideas
    .filter((i) => (i.status === "idea" || i.status === "planned") && !i.jobId && DRAFTABLE.includes(i.format))
    .map((i) => ({ ...i, overdue: Boolean(i.dueDate && i.dueDate <= now) }))
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        Number(b.status === "planned") - Number(a.status === "planned") ||
        (b.score ?? 0) - (a.score ?? 0) ||
        (b.volume ?? 0) - (a.volume ?? 0) ||
        String(a.createdAt).localeCompare(String(b.createdAt))
    );
}

const STOP = new Set(["the", "and", "for", "how", "why", "who", "our", "you", "are", "can", "with", "your", "from", "that", "this", "what", "when", "which", "into", "about", "need", "does", "have", "guide", "commercial", "london", "kent"]);
// Words of three letters or more (VRF, LED, EV) with plurals folded ("offices" → "office").
const stem = (w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const terms = (text) => new Set(String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem));

/**
 * A real photo for an idea's blog post: the main photo of the finished job
 * that shares the most words with the idea. null if nothing is related —
 * an unrelated photo is worse than asking for one.
 */
export function relatedPhoto(idea, jobs) {
  const want = terms(`${idea.title} ${idea.keyword || ""} ${idea.angle || ""}`);
  let best = null;
  for (const job of jobs) {
    if (isIdeaJob(job)) continue;
    const photo = mainImageOf(job);
    if (!photo) continue;
    const have = terms(`${job.title} ${job.writeUp || ""} ${(job.details?.services || []).join(" ")} ${job.details?.sector || ""} ${job.content?.caseStudy?.primaryKeyword || ""}`);
    const score = [...want].filter((w) => have.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { score, photo, jobId: job.id, jobTitle: job.title };
  }
  return best && { ...best.photo, from: { jobId: best.jobId, jobTitle: best.jobTitle } };
}

/* --- Drafting -------------------------------------------------------------- */

/** Make an idea's draft: a job linked to the idea, written by AI towards its target. */
export async function draftFromIdea(ideaId, { formats = DEFAULT_AUTOPILOT.formats, photos = true, user, by = "person", model } = {}) {
  const idea = await getIdea(ideaId);
  if (!idea) throw new Error("Idea not found.");
  if (idea.jobId) throw new Error("This idea already has a draft or job.");
  if (idea.format === "case-study") throw new Error("Case studies come from finished jobs — start a job with photos instead.");

  const photo = photos ? relatedPhoto(idea, await listJobs()) : null;
  const { from, ...image } = photo || {};
  const job = await createJob({
    title: idea.title,
    writeUp: [idea.angle || `Write about: ${idea.title}`, idea.sourceDetail && `Why now: ${idea.sourceDetail}`, idea.notes].filter(Boolean).join("\n\n"),
    images: photo ? [image] : [],
    source: by === "autopilot" ? "autopilot" : "idea",
    user,
    extra: { kind: "idea", ideaId: idea.id, target: targetFromIdea(idea), photoFrom: from || null },
  });
  await linkJob(idea.id, job.id);
  try {
    const written = await generateForJob(job.id, { sections: [...formats.filter((f) => AUTOPILOT_FORMATS[f]), "seo"], model });
    return { job: written, error: null };
  } catch (error) {
    // The draft stays: it can be written by hand or retried from the job.
    return { job, error: error.message };
  }
}

/** Rough cost of a run: one planner call plus one writing call per draft. */
export async function estimateAutopilot(config) {
  try {
    const modelId = await getActiveModel();
    const model = (await gatewayModels()).find((m) => m.id === modelId);
    const usage = await averageJobUsage();
    const perDraft = estimateCost(model, usage);
    const plan = estimateCost(model, { inputTokens: 6000, outputTokens: 3000 });
    if (perDraft == null) return { model: modelId, perDraft: null, total: null };
    return { model: modelId, perDraft, plan: config.plan ? plan : 0, total: perDraft * config.perRun + (config.plan ? plan || 0 : 0) };
  } catch {
    return { model: null, perDraft: null, total: null };
  }
}

/** One full autopilot run: plan (optional), then draft the top ideas. */
export async function runAutopilot({ user, trigger = "manual", ...overrides } = {}) {
  const config = cleanAutopilot({ ...(await getAutopilot()), ...overrides, enabled: true });
  const run = await runs().insert({ status: "running", trigger, config, createdBy: user?.email || null, drafts: [], cost: 0 });
  let cost = 0;
  let planned = null;
  let planError = null;
  if (config.plan) {
    try {
      const result = await planIdeas(user);
      planned = { added: result.added, suggested: result.suggested };
      cost += result.run?.costUsd || 0;
    } catch (error) {
      planError = error.message;
    }
  }
  const picks = rankIdeas(await listIdeas()).slice(0, config.perRun);
  const drafts = [];
  for (const idea of picks) {
    try {
      const { job, error } = await draftFromIdea(idea.id, { formats: config.formats, photos: config.photos, user, by: "autopilot" });
      cost += job.aiRuns?.at(-1)?.costUsd || 0;
      drafts.push({ ideaId: idea.id, jobId: job.id, title: job.title, keyword: idea.keyword || null, photo: Boolean(job.images?.length), error });
    } catch (error) {
      drafts.push({ ideaId: idea.id, jobId: null, title: idea.title, keyword: idea.keyword || null, error: error.message });
    }
  }
  return runs().update(run.id, {
    status: "done",
    planned,
    planError,
    drafts,
    cost,
    note: picks.length ? null : "No open ideas to draft — add some to the pipeline or switch planning on.",
    finishedAt: new Date().toISOString(),
  });
}

export async function listAutopilotRuns(limit = 5) {
  return runs().find({}, { sort: { createdAt: -1 }, limit }).catch(() => []);
}
