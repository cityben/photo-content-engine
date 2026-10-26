/**
 * Sandbox stand-in for Buffer: fake LinkedIn and Instagram channels that
 * behave like Buffer (queueing, scheduling, editing, deleting) without
 * touching real accounts. Posts whose time has passed show as "sent".
 *
 * Metrics here are SIMULATED so the analytics screens can be tried out —
 * every response carries `simulated: true` and the UI labels them.
 */

import { collection } from "@/lib/store";
import { nextQueueSlot } from "@/lib/time";

export const SANDBOX_CHANNELS = [
  { id: "sandbox-linkedin", name: "Acme Ltd (sandbox)", service: "linkedin" },
  { id: "sandbox-instagram", name: "acme (sandbox)", service: "instagram" },
].map((c) => ({ ...c, avatar: null, timezone: "Europe/London", paused: false, disconnected: false }));

const posts = () => collection("sandbox_posts");

function withLiveStatus(post, now = Date.now()) {
  if (post.status === "scheduled" && new Date(post.dueAt).getTime() <= now) {
    return { ...post, status: "sent", sentAt: post.dueAt };
  }
  return post;
}

function channel(id) {
  const found = SANDBOX_CHANNELS.find((c) => c.id === id);
  if (!found) throw new Error("Unknown sandbox channel");
  return found;
}

export function validatePost({ service, text, images = [] }) {
  if (service === "instagram" && !images.length) {
    throw new Error("Instagram posts need at least one photo.");
  }
  if (service === "instagram" && images.length > 10) {
    throw new Error("Instagram carousels take up to 10 photos.");
  }
  if (!text?.trim() && !images.length) throw new Error("Add some text or a photo.");
  const limit = { linkedin: 3000, instagram: 2200 }[service];
  if (limit && text.length > limit) {
    throw new Error(`${service === "linkedin" ? "LinkedIn" : "Instagram"} allows ${limit} characters.`);
  }
}

export async function listChannels() {
  return SANDBOX_CHANNELS;
}

export async function listPosts({ start, end, statuses, channelIds } = {}) {
  const all = (await posts().find({}, { sort: { dueAt: 1 } })).map((p) => withLiveStatus(p));
  return all.filter(
    (p) =>
      (!start || p.dueAt >= start) &&
      (!end || p.dueAt <= end) &&
      (!statuses || statuses.includes(p.status)) &&
      (!channelIds?.length || channelIds.includes(p.channelId))
  );
}

export async function getPost(id) {
  const post = await posts().get(id);
  return post ? withLiveStatus(post) : null;
}

export async function createPost({ channelId, service, text, images = [], dueAt, firstComment }) {
  const ch = channel(channelId);
  validatePost({ service: ch.service, text, images });

  let when = dueAt;
  if (!when) {
    const taken = (await posts().find({ channelId, status: "scheduled" })).map((p) => p.dueAt);
    when = nextQueueSlot(new Date(), taken).toISOString();
  }
  if (new Date(when).getTime() < Date.now() - 60000) {
    throw new Error("Pick a time in the future.");
  }

  return posts().insert({
    channelId,
    service: ch.service,
    channelName: ch.name,
    avatar: null,
    text,
    images: images.map((i) => i.url),
    firstComment: firstComment || null,
    status: "scheduled",
    dueAt: new Date(when).toISOString(),
    sentAt: null,
    externalLink: null,
    error: null,
  });
}

export async function editPost(id, { text, dueAt }) {
  const current = await getPost(id);
  if (!current) throw new Error("Post not found");
  if (current.status !== "scheduled") throw new Error("Only scheduled posts can be edited.");
  validatePost({ service: current.service, text: text ?? current.text, images: current.images });
  if (dueAt && new Date(dueAt).getTime() < Date.now() - 60000) {
    throw new Error("Pick a time in the future.");
  }
  return posts().update(id, {
    ...(text !== undefined && { text }),
    ...(dueAt && { dueAt: new Date(dueAt).toISOString() }),
  });
}

export async function deletePost(id) {
  const current = await getPost(id);
  if (!current) throw new Error("Post not found");
  await posts().remove(id);
  return true;
}

// Deterministic pseudo-random numbers per post, so simulated stats don't jump around.
function seeded(id, salt) {
  let h = 2166136261;
  for (const ch of `${id}:${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function simulatedMetrics(post, now = Date.now()) {
  if (post.status !== "sent") return null;
  const ageHours = Math.max(0, (now - new Date(post.sentAt).getTime()) / 3600000);
  const growth = Math.min(1, ageHours / 72);
  const base = post.service === "instagram" ? 900 : 1400;
  const impressions = Math.round((base * 0.4 + base * seeded(post.id, "imp")) * growth);
  const reactions = Math.round(impressions * (0.02 + 0.04 * seeded(post.id, "rx")));
  const comments = Math.round(reactions * (0.05 + 0.15 * seeded(post.id, "cm")));
  const shares = Math.round(reactions * 0.1 * seeded(post.id, "sh"));
  const clicks = Math.round(impressions * 0.012 * seeded(post.id, "cl"));
  const engaged = reactions + comments + shares + clicks;
  return [
    { type: "impressions", name: "Impressions", value: impressions, unit: "count" },
    { type: "reactions", name: "Reactions", value: reactions, unit: "count" },
    { type: "comments", name: "Comments", value: comments, unit: "count" },
    { type: "shares", name: "Shares", value: shares, unit: "count" },
    { type: "clicks", name: "Clicks", value: clicks, unit: "count" },
    {
      type: "engagementRate",
      name: "Engagement rate",
      value: impressions ? Math.round((engaged / impressions) * 10000) / 100 : 0,
      unit: "percentage",
    },
  ];
}
