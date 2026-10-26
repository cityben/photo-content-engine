/**
 * Jobs: one piece of finished work (photos + write-up) and everything made
 * from it — social posts, the website case study, keywords, advice.
 */

import { defaultSections, generateJobContent } from "@/lib/ai";
import { cached } from "@/lib/cache";
import { completeness } from "@/lib/case-study-fields";
import { APPROVABLE, hasSubstance, isIdeaJob, mainImageOf, orderedImages, SECTION_LABEL } from "@/lib/content";
import { markPublishedForJob } from "@/lib/ideas";
import { deleteImage } from "@/lib/media";
import { nextSlotFor } from "@/lib/schedule";
import { createPost, listChannels, listPosts, socialMode } from "@/lib/social";
import { getTemplates } from "@/lib/template-store";
import { applyTemplates } from "@/lib/templates";
import { collection } from "@/lib/store";
import { createBlogDraft, createCaseStudyDraft, getSearchQueries, websiteConfig, websiteConfigured } from "@/lib/website-api";

const jobs = () => collection("jobs");

export async function listJobs() {
  return jobs().find({}, { sort: { createdAt: -1 } });
}

export async function getJob(id) {
  return jobs().get(id);
}

export { APPROVABLE, hasSubstance, isIdeaJob, needsApproval } from "@/lib/content";

/* --- Approval ---------------------------------------------------------------
   Nothing reaches Buffer or the website until a person approves that exact
   section. Any change to an approved section — by hand or by AI — clears its
   approval, and scheduling uses the saved, approved text, never text sent
   from the browser. */

export class ApprovalError extends Error {
  constructor(section) {
    super(`Approve the ${SECTION_LABEL[section] || section} before it goes out.`);
    this.name = "ApprovalError";
  }
}

/** Approvals that survive a content change: only sections whose content is identical. */
function keepApprovals(job, nextContent) {
  const approvals = { ...(job.approvals || {}) };
  for (const section of APPROVABLE) {
    if (JSON.stringify(job.content?.[section] ?? null) !== JSON.stringify(nextContent?.[section] ?? null)) {
      approvals[section] = null;
    }
  }
  return approvals;
}

export async function setApproval(id, section, approved, user) {
  const job = await getJob(id);
  if (!job) throw new Error("Job not found");
  if (!APPROVABLE.includes(section)) throw new Error("That section can't be approved.");
  if (approved && !hasSubstance(section, job.content?.[section])) {
    throw new Error(`The ${SECTION_LABEL[section]} is empty — write it first.`);
  }
  return updateJob(id, {
    approvals: {
      ...(job.approvals || {}),
      [section]: approved ? { by: user?.email || null, at: new Date().toISOString() } : null,
    },
  });
}

export async function createJob({ title, writeUp, details, images, mainImage, content, source, user, extra = {} }) {
  return jobs().insert({
    ...extra,
    title: title?.trim() || "Untitled job",
    writeUp: writeUp || "",
    details: details || {},
    images: images || [],
    mainImage: mainImage || images?.[0]?.url || null,
    content: content || {},
    approvals: {},
    source: source || "manual",
    posts: [],
    website: null,
    createdBy: user?.email || null,
    generatedAt: null,
  });
}

export async function updateJob(id, patch) {
  return jobs().update(id, patch);
}

/** Edits from the editor. Changed sections lose their approval. */
export async function saveJobEdits(id, input) {
  const job = await getJob(id);
  if (!job) return null;
  const patch = { ...input };
  if (input.details) patch.details = { ...job.details, ...input.details };
  if (input.content) {
    patch.content = { ...job.content, ...input.content };
    patch.approvals = keepApprovals(job, patch.content);
    // A hand edit makes the saved "previous AI version" stale.
    patch.previousContent = null;
  }
  return updateJob(id, patch);
}

export async function deleteJob(id) {
  const job = await getJob(id);
  if (!job) return false;
  // A photo can be shared (an idea's draft borrowing a job's photo): only
  // delete files no other job uses.
  const others = (await listJobs()).filter((j) => j.id !== id);
  const inUse = new Set(others.flatMap((j) => (j.images || []).map((i) => i.url)));
  await Promise.all((job.images || []).filter((img) => !inUse.has(img.url)).map((img) => deleteImage(img.url)));
  return jobs().remove(id);
}

/** Last 90 days of Search Console queries from the website, cached for 6 hours. */
export async function searchConsoleData({ refresh = false } = {}) {
  if (!(await websiteConfigured())) return null;
  try {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const { value } = await cached(
      `gsc-queries-90d-${(await websiteConfig()).siteUrl}`,
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

/**
 * `preserve`: sections whose existing non-empty fields win over the AI's
 * (e.g. a case study imported from Word — AI only fills the gaps).
 */
export async function generateForJob(id, { sections: asked, instructions, model, preserve = [] } = {}) {
  const job = await getJob(id);
  if (!job) throw new Error("Job not found");
  // An idea has no finished work behind it, so never a case study.
  const sections = (asked || defaultSections(job)).filter((s) => !(isIdeaJob(job) && s === "caseStudy"));
  if (!sections.length) throw new Error("Ideas get a blog post and posts — case studies come from finished jobs.");
  // An idea's title and target are its brief; a finished job needs something to describe.
  if (!isIdeaJob(job) && !job.images?.length && !job.writeUp?.trim()) {
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

  // House top/bottom text goes in word for word, after the AI.
  Object.assign(content, applyTemplates(content, await getTemplates(), job, sections));

  for (const section of preserve) {
    const existing = job.content?.[section];
    if (existing && content[section]) {
      const kept = Object.fromEntries(
        Object.entries(existing).filter(([, v]) => (Array.isArray(v) ? v.length : v !== "" && v != null))
      );
      content[section] = { ...content[section], ...kept };
    }
  }

  // Keep the previous version of rewritten sections, so model comparisons can be undone.
  const previous = Object.fromEntries(sections.filter((s) => job.content?.[s]).map((s) => [s, job.content[s]]));
  const nextContent = { ...job.content, ...content };

  return updateJob(id, {
    content: nextContent,
    approvals: keepApprovals(job, nextContent),
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

export async function scheduleForJob(id, { channelId, dueAt, imageUrls }) {
  const job = await getJob(id);
  if (!job) throw new Error("Job not found");
  const channel = (await listChannels()).find((c) => c.id === channelId);
  if (!channel) throw new Error("That channel isn't connected.");
  if (!job.approvals?.[channel.service]) throw new ApprovalError(channel.service);

  // The saved, approved wording — not whatever the browser sent.
  const text = defaultPostText(job, channel.service);
  const firstComment = job.content?.[channel.service]?.firstComment;

  // Main building photo first, then the rest in the chosen order.
  const images = orderedImages(job).filter((img) => !imageUrls || imageUrls.includes(img.url));
  const caseStudyUrl = job.website?.url || job.blogPost?.url;
  const comment = firstComment?.replace("{{case_study_url}}", caseStudyUrl || "").trim();

  // "Next slot": the app's publishing schedule picks the time, skipping
  // slots already booked on this channel.
  let when = dueAt;
  if (!when) {
    const booked = await listPosts({
      start: new Date().toISOString(),
      end: new Date(Date.now() + 120 * 86400000).toISOString(),
      statuses: ["scheduled", "sending"],
      channelIds: [channel.id],
    });
    when = (await nextSlotFor(channel.service, booked.map((p) => p.dueAt))).toISOString();
  }

  const post = await createPost({
    channel,
    text,
    images: channel.service === "instagram" || images.length ? images : [],
    dueAt: when,
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
  if (!job.content?.caseStudy) throw new Error("Write the case study first.");
  if (!job.approvals?.caseStudy) throw new ApprovalError("caseStudy");
  if (job.website?.projectId) throw new Error("This job already has a case study on the website.");
  const { required } = completeness(job.content.caseStudy);
  if (required.length) throw new Error(`The website needs: ${required.map((m) => m.label).join(", ")}.`);

  const cs = job.content.caseStudy;
  const result = await createCaseStudyDraft({
    caseStudy: {
      ...cs,
      dateCompleted: job.details?.completedOn || undefined,
    },
    // The main building photo becomes the website's mainImage (hero + cards).
    photos: orderedImages(job).map((img, i) => ({ url: img.url, alt: i === 0 ? cs.mainImageAlt : img.alt })),
    idempotencyKey: `job-${job.id}`,
  });

  await updateJob(id, { website: { ...result, sentAt: new Date().toISOString() } });
  await markPublishedForJob(job);
  return result;
}

/** Send the approved blog post to the website as a draft (published: false). */
export async function sendBlog(id) {
  const job = await getJob(id);
  if (!job) throw new Error("Job not found");
  const blog = job.content?.blog;
  if (!hasSubstance("blog", blog)) throw new Error("Write the blog post first.");
  if (!job.approvals?.blog) throw new ApprovalError("blog");
  if (job.blogPost?.id) throw new Error("This blog post is already on the website.");
  const missing = [!blog.excerpt?.trim() && "summary", !blog.category?.trim() && "category"].filter(Boolean);
  if (missing.length) throw new Error(`The website needs a ${missing.join(" and ")}.`);
  const photo = mainImageOf(job);
  if (!photo) throw new Error("The website needs a header photo for every blog post — add one in Photos & brief.");

  const result = await createBlogDraft({ blog, photo, idempotencyKey: `job-${job.id}-blog` });
  await updateJob(id, { blogPost: { ...result, sentAt: new Date().toISOString() } });
  await markPublishedForJob(job);
  return result;
}

/** Google Business posts go up by hand (copy and paste); this records that it's done. */
export async function markGooglePosted(id, user) {
  const job = await getJob(id);
  if (!job) throw new Error("Job not found");
  if (!job.approvals?.googleBusiness) throw new ApprovalError("googleBusiness");
  return updateJob(id, { googlePosted: { by: user?.email || null, at: new Date().toISOString() } });
}

/** A post was deleted: drop it from its job so the job shows as ready again. */
export async function forgetPost(postId) {
  const [job] = await jobs().find({ "posts.postId": postId });
  if (job) await updateJob(job.id, { posts: job.posts.filter((p) => p.postId !== postId) });
}

/** Approved LinkedIn/Instagram content with nothing scheduled yet — the calendar's tray. */
export async function readyToSchedule() {
  const all = await listJobs();
  const items = [];
  for (const job of all) {
    for (const service of ["linkedin", "instagram"]) {
      if (!job.approvals?.[service] || !hasSubstance(service, job.content?.[service])) continue;
      if ((job.posts || []).some((p) => p.service === service)) continue;
      const main = orderedImages(job)[0];
      items.push({
        jobId: job.id,
        jobTitle: job.title,
        service,
        text: defaultPostText(job, service),
        image: main?.url || null,
        approvedAt: job.approvals[service].at,
      });
    }
  }
  return items.sort((a, b) => (a.approvedAt < b.approvedAt ? -1 : 1));
}
