/**
 * Content pipeline: ideas → planned → in progress → published.
 *
 * Ideas come from search data (keyword gaps, keyword ideas, questions AI
 * assistants are asked), from the AI planner, or from the team. Starting a
 * job from an idea links them, and the job writes towards the idea's target
 * keyword. Ideas are internal notes, so they need no approval — the posts and
 * case studies made from them still do.
 */

import { collection } from "@/lib/store";

export const STAGES = [
  { id: "idea", label: "Ideas" },
  { id: "planned", label: "Planned" },
  { id: "in_progress", label: "In progress" },
  { id: "published", label: "Published" },
];
export const STAGE_IDS = STAGES.map((s) => s.id);

export const FORMATS = {
  "case-study": "Case study",
  "service-page": "Service page",
  article: "Guide / article",
  linkedin: "LinkedIn post",
  "google-business": "Google Business post",
};

export const SOURCES = {
  team: "Team",
  ai: "AI planner",
  gap: "Competitor gap",
  ideas: "Keyword demand",
  "search-console": "Search Console",
  "ai-question": "AI question",
};

const ideas = () => collection("ideas");

export async function listIdeas() {
  return ideas().find({}, { sort: { createdAt: -1 } });
}

export async function getIdea(id) {
  return ideas().get(id);
}

/** Same keyword (or same title without one) already in the pipeline? */
export async function findDuplicate({ keyword, title }) {
  const all = await listIdeas();
  const k = keyword?.trim().toLowerCase();
  const t = title?.trim().toLowerCase();
  return all.find((i) => (k && i.keyword?.toLowerCase() === k) || (!k && t && i.title.toLowerCase() === t)) || null;
}

export async function createIdea(input, user) {
  const existing = await findDuplicate(input);
  if (existing) return { idea: existing, duplicate: true };
  const idea = await ideas().insert({
    title: input.title.trim(),
    angle: input.angle?.trim() || "",
    keyword: input.keyword?.trim().toLowerCase() || null,
    volume: input.volume ?? null,
    score: input.score ?? null,
    format: input.format || "case-study",
    source: input.source || "team",
    sourceDetail: input.sourceDetail || null,
    status: input.status || "idea",
    dueDate: input.dueDate || null,
    notes: input.notes || "",
    jobId: null,
    order: Date.now(),
    createdBy: user?.email || null,
  });
  return { idea, duplicate: false };
}

export async function updateIdea(id, patch) {
  return ideas().update(id, patch);
}

export async function deleteIdea(id) {
  return ideas().remove(id);
}

/** Called when a job is created from an idea. */
export async function linkJob(ideaId, jobId) {
  const idea = await getIdea(ideaId);
  if (!idea) return null;
  return updateIdea(ideaId, { jobId, status: idea.status === "published" ? "published" : "in_progress" });
}

/** Called when a job's case study reaches the website. */
export async function markPublishedForJob(job) {
  if (!job?.ideaId) return;
  try {
    await updateIdea(job.ideaId, { status: "published", publishedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[ideas] couldn't mark published:", error.message);
  }
}

/** The target an idea gives its job (used in the AI brief). */
export function targetFromIdea(idea) {
  if (!idea) return null;
  return { keyword: idea.keyword || null, volume: idea.volume ?? null, angle: idea.angle || idea.title, format: idea.format };
}
