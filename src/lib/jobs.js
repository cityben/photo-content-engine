/**
 * Jobs: one piece of finished work (photos + write-up) and everything made
 * from it — social posts, the website case study, keywords, advice.
 */

import { generateJobContent, SECTIONS } from "@/lib/ai";
import { cached } from "@/lib/cache";
import { deleteImage } from "@/lib/media";
import { createPost, listChannels, socialMode } from "@/lib/social";
import { collection } from "@/lib/store";
import { createCaseStudyDraft, getSearchQueries, websiteConfigured } from "@/lib/website-api";

const jobs = () => collection("jobs");

export async function listJobs() {
  return jobs().find({}, { sort: { createdAt: -1 } });
}

export async function getJob(id) {
  return jobs().get(id);
}

export async function createJob({ title, writeUp, details, images, user }) {
  return jobs().insert({
    title: title?.trim() || "Untitled job",
    writeUp: writeUp || "",
    details: details || {},
    images: images || [],
    content: {},
    posts: [],
    website: null,
    createdBy: user?.email || null,
    generatedAt: null,
  });
}

export async function updateJob(id, patch) {
  return jobs().update(id, patch);
}

export async function deleteJob(id) {
  const job = await getJob(id);
  if (!job) return false;
  await Promise.all((job.images || []).map((img) => deleteImage(img.url)));
  return jobs().remove(id);
}

/** Last 90 days of Search Console queries from the website, cached for 6 hours. */
export async function searchConsoleData({ refresh = false } = {}) {
  if (!websiteConfigured()) return null;
  try {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const { value } = await cached(
      `gsc-queries-90d`,
      6 * 3600000,
      () => getSearchQueries({ from, to, limit: 300 }),
      { refresh }
    );
    return value;
  } catch (error) {
    console.error("[jobs] Search Console data unavailable:", error.message);
    return null;
  }
}

/** Search Console rows that share words with the job, best first. */
function relevantQueries(searchData, job) {
  if (!searchData?.rows?.length) return searchData;
  const text = `${job.title} ${job.writeUp} ${(job.details?.services || []).join(" ")} ${job.details?.sector || ""}`.toLowerCase();
  const words = new Set(text.split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const score = (row) => row.key.toLowerCase().split(/\s+/).filter((w) => words.has(w)).length;
  const rows = [...searchData.rows].sort((a, b) => score(b) - score(a) || b.impressions - a.impressions);
  return { ...searchData, rows };
}

export async function generateForJob(id, { sections = SECTIONS, instructions, model } = {}) {
  const job = await getJob(id);
  if (!job) throw new Error("Job not found");
  if (!job.images?.length && !job.writeUp?.trim()) {
    throw new Error("Add at least one photo or a write-up first.");
  }

  const searchData = relevantQueries(await searchConsoleData(), job);
  const { content, run } = await generateJobContent(job, {
    sections,
    searchData,
    instructions,
    current: job.content,
    model,
  });

  // Keep the previous version of rewritten sections, so model comparisons can be undone.
  const previous = Object.fromEntries(sections.filter((s) => job.content?.[s]).map((s) => [s, job.content[s]]));

  return updateJob(id, {
    content: { ...job.content, ...content },
    previousContent: Object.keys(previous).length ? { ...previous, model: job.model || null } : job.previousContent || null,
    generatedAt: run.at,
    model: run.model,
    aiRuns: [...(job.aiRuns || []), run].slice(-20),
    searchDataUsed: Boolean(searchData?.rows?.length),
  });
}

function withHashtags(text, hashtags = []) {
  const missing = hashtags.filter((t) => !text.includes(t));
  return missing.length ? `${text.trim()}\n\n${missing.join(" ")}` : text.trim();
}

/** Default post text for a channel from the job's generated content. */
export function defaultPostText(job, service) {
  const c = job.content || {};
  if (service === "linkedin" && c.linkedin) return withHashtags(c.linkedin.text, c.linkedin.hashtags);
  if (service === "instagram" && c.instagram) return withHashtags(c.instagram.caption, c.instagram.hashtags);
  return "";
}

export async function scheduleForJob(id, { channelId, text, dueAt, firstComment, imageUrls }) {
  const job = await getJob(id);
  if (!job) throw new Error("Job not found");
  const channel = (await listChannels()).find((c) => c.id === channelId);
  if (!channel) throw new Error("That channel isn't connected.");

  const images = (job.images || []).filter((img) => !imageUrls || imageUrls.includes(img.url));
  const caseStudyUrl = job.website?.url;
  const comment = firstComment?.replace("{{case_study_url}}", caseStudyUrl || "").trim();

  const post = await createPost({
    channel,
    text,
    images: channel.service === "instagram" || images.length ? images : [],
    dueAt,
    firstComment: comment || undefined,
    job,
  });

  const record = {
    postId: post.id,
    channelId: channel.id,
    channelName: channel.name,
    service: channel.service,
    dueAt: post.dueAt,
    mode: socialMode(),
    createdAt: new Date().toISOString(),
  };
  await updateJob(id, { posts: [...(job.posts || []), record] });
  return post;
}

export async function sendCaseStudy(id) {
  const job = await getJob(id);
  if (!job) throw new Error("Job not found");
  if (!job.content?.caseStudy) throw new Error("Generate the case study first.");
  if (job.website?.projectId) throw new Error("This job already has a case study on the website.");

  const cs = job.content.caseStudy;
  const result = await createCaseStudyDraft({
    caseStudy: {
      ...cs,
      dateCompleted: job.details?.completedOn || undefined,
    },
    photos: (job.images || []).map((img, i) => ({ url: img.url, alt: i === 0 ? cs.mainImageAlt : img.alt })),
    idempotencyKey: `job-${job.id}`,
  });

  await updateJob(id, { website: { ...result, sentAt: new Date().toISOString() } });
  return result;
}
