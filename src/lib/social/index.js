/**
 * One interface over Buffer (live) and the sandbox.
 *
 *   live    — BUFFER_API_KEY is set (and SOCIAL_MODE isn't "sandbox").
 *             Reads always work; creating/editing/deleting needs
 *             ENABLE_BUFFER_POSTING=true, so nothing reaches real
 *             accounts by accident.
 *   sandbox — no key, or SOCIAL_MODE=sandbox. Fake LinkedIn + Instagram
 *             channels; nothing leaves the app.
 */

import { collection } from "@/lib/store";

import * as buffer from "./buffer";
import * as sandbox from "./sandbox";

export function socialMode() {
  if (process.env.SOCIAL_MODE === "sandbox") return "sandbox";
  return buffer.bufferApiKey() ? "live" : "sandbox";
}

export function postingEnabled() {
  return socialMode() === "sandbox" || process.env.ENABLE_BUFFER_POSTING === "true";
}

const provider = () => (socialMode() === "live" ? buffer : sandbox);

export class PostingDisabledError extends Error {
  constructor() {
    super("Posting to Buffer is switched off. Set ENABLE_BUFFER_POSTING=true to schedule real posts.");
    this.name = "PostingDisabledError";
  }
}

function assertWritable() {
  if (!postingEnabled()) throw new PostingDisabledError();
}

export const SUPPORTED_SERVICES = ["linkedin", "instagram"];

export async function listChannels() {
  const channels = await provider().listChannels();
  return channels.filter((c) => SUPPORTED_SERVICES.includes(c.service));
}

// Which job each post came from, so the calendar can link back to it.
const links = () => collection("post_links");

async function attachJobs(posts) {
  if (!posts.length) return posts;
  const found = await links().find({ postId: { $in: posts.map((p) => p.id) } });
  const byPost = new Map(found.map((l) => [l.postId, l]));
  return posts.map((p) => ({
    ...p,
    jobId: byPost.get(p.id)?.jobId || null,
    jobTitle: byPost.get(p.id)?.jobTitle || null,
  }));
}

export async function listPosts(options = {}) {
  const posts = await provider().listPosts(options);
  const filtered = posts.filter((p) => !p.service || SUPPORTED_SERVICES.includes(p.service));
  if (socialMode() === "sandbox" && options.withMetrics) {
    filtered.forEach((p) => {
      p.metrics = sandbox.simulatedMetrics(p);
      p.metricsUpdatedAt = p.metrics ? new Date().toISOString() : null;
      p.simulated = Boolean(p.metrics);
    });
  }
  return attachJobs(filtered);
}

export async function getPost(id) {
  const post = await provider().getPost(id);
  if (!post) return null;
  if (socialMode() === "sandbox") {
    post.metrics = sandbox.simulatedMetrics(post);
    post.simulated = Boolean(post.metrics);
  }
  return (await attachJobs([post]))[0];
}

/**
 * Schedule a post. `dueAt` (ISO) for a set time, or omit to add to the queue.
 * `images`: [{ url, width, height, alt, public }].
 */
export async function createPost({ channel, text, images = [], dueAt, firstComment, job }) {
  assertWritable();
  if (socialMode() === "live" && images.some((i) => !i.public)) {
    throw new Error(
      "Photos must be publicly hosted for Buffer to fetch them. Connect Vercel Blob (BLOB_READ_WRITE_TOKEN) and re-upload."
    );
  }
  sandbox.validatePost({ service: channel.service, text, images });

  const post = await provider().createPost({
    channelId: channel.id,
    service: channel.service,
    text,
    images,
    dueAt,
    firstComment,
  });

  if (job) {
    await links().insert({
      postId: post.id,
      jobId: job.id,
      jobTitle: job.title,
      channelId: channel.id,
      service: channel.service,
      mode: socialMode(),
    });
  }
  return post;
}

export async function editPost(id, changes) {
  assertWritable();
  return provider().editPost(id, changes);
}

export async function deletePost(id) {
  assertWritable();
  await provider().deletePost(id);
  const link = (await links().find({ postId: id }))[0];
  if (link) await links().remove(link.id);
  return true;
}

const METRIC_ORDER = ["impressions", "reach", "reactions", "likes", "comments", "shares", "reposts", "clicks", "saves", "engagementRate"];

function sumMetrics(posts) {
  const totals = new Map();
  for (const post of posts) {
    for (const m of post.metrics || []) {
      if (m.unit === "percentage") continue;
      const t = totals.get(m.type) || { type: m.type, name: m.name, value: 0, unit: m.unit };
      t.value += Number(m.value) || 0;
      totals.set(m.type, t);
    }
  }
  const list = [...totals.values()];
  const impressions = totals.get("impressions")?.value;
  if (impressions) {
    const engaged = ["reactions", "likes", "comments", "shares", "reposts", "clicks", "saves"]
      .map((t) => totals.get(t)?.value || 0)
      .reduce((a, b) => a + b, 0);
    list.push({
      type: "engagementRate",
      name: "Engagement rate",
      value: Math.round((engaged / impressions) * 10000) / 100,
      unit: "percentage",
    });
  }
  return list.sort((a, b) => METRIC_ORDER.indexOf(a.type) - METRIC_ORDER.indexOf(b.type));
}

/**
 * Analytics for a window: sent posts with metrics, totals per channel, and
 * a flag saying whether the numbers are real (Buffer) or simulated (sandbox).
 */
export async function analytics({ start, end }) {
  const [channels, posts] = await Promise.all([
    listChannels(),
    listPosts({ start, end, statuses: ["sent"], withMetrics: true }),
  ]);

  const perChannel = channels.map((channel) => {
    const own = posts.filter((p) => p.channelId === channel.id);
    return { channel, postCount: own.length, metrics: sumMetrics(own) };
  });

  const updatedTimes = posts.map((p) => p.metricsUpdatedAt).filter(Boolean).sort();
  return {
    mode: socialMode(),
    simulated: socialMode() === "sandbox",
    posts,
    totals: sumMetrics(posts),
    perChannel,
    metricsUpdatedAt: updatedTimes.at(-1) || null,
  };
}

export async function status() {
  const mode = socialMode();
  const result = { mode, postingEnabled: postingEnabled(), ok: true, error: null, account: null };
  if (mode === "live") {
    try {
      const account = await buffer.getAccount();
      result.account = {
        email: account.email,
        timezone: account.timezone,
        organizations: account.organizations,
      };
    } catch (error) {
      result.ok = false;
      result.error = error.message;
    }
  }
  return result;
}
