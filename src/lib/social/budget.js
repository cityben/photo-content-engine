/**
 * Buffer's API allows few requests: by plan, roughly 100–500 per 24 hours
 * and 100 per 15 minutes, per API client. So every Buffer read goes through
 * here:
 *
 *  - Results are cached in the store, so pages, the to-do bell and every
 *    server instance share one copy instead of each asking Buffer.
 *  - Identical calls already in flight are merged.
 *  - After a 429, nothing is sent until Buffer's wait is over; reads fall
 *    back to the last saved copy, however old.
 *  - Every real request is counted, so Settings can show what's been used.
 *
 * Post lists carry a version that bumps whenever this app creates, edits or
 * deletes a post, so the app's own changes show at once.
 */

import { collection } from "@/lib/store";

const cache = () => collection("cache");
const state = (globalThis.__bufferBudget ||= { inflight: new Map(), blockedUntil: 0 });
const DAY = 864e5;

async function readDoc(key) {
  try {
    const [doc] = await cache().find({ key });
    return doc || null;
  } catch (error) {
    console.error(`[buffer] cache read failed for ${key}:`, error.message);
    return null;
  }
}

async function writeDoc(key, value, existing) {
  try {
    const doc = existing || (await readDoc(key));
    return doc ? await cache().update(doc.id, { value }) : await cache().insert({ key, value });
  } catch (error) {
    console.error(`[buffer] cache write failed for ${key}:`, error.message);
    return null;
  }
}

/* --- The stop after a 429 ------------------------------------------------- */

/** Epoch ms until which no request may be sent, or 0. */
export async function blockedUntil() {
  if (state.blockedUntil > Date.now()) return state.blockedUntil;
  const doc = await readDoc("buffer:blocked");
  const until = doc?.value?.until ? new Date(doc.value.until).getTime() : 0;
  state.blockedUntil = until > Date.now() ? until : 0;
  return state.blockedUntil;
}

export async function block(seconds) {
  // No Retry-After: wait 15 minutes, the shortest window Buffer uses.
  const until = Date.now() + Math.max(60, Number(seconds) || 900) * 1000;
  state.blockedUntil = until;
  await writeDoc("buffer:blocked", { until: new Date(until).toISOString() });
  return until;
}

/** "16:13 (in 4 min)", or "Tue 09:20 (in 20 hours)" — when Buffer can be asked again. */
export function untilText(until) {
  const d = new Date(until);
  const sameDay = d.toDateString() === new Date().toDateString();
  const clock = d.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", ...(!sameDay && { weekday: "short" }) });
  const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000));
  return `${clock} (in ${mins < 90 ? `${mins} min` : `${Math.round(mins / 60)} hours`})`;
}

/* --- Counting --------------------------------------------------------------- */

/** Rate-limit headers Buffer sends back, kept as-is for the Settings page. */
function limitHeaders(headers) {
  const out = {};
  headers?.forEach?.((value, name) => {
    if (/ratelimit|retry-after/i.test(name)) out[name.toLowerCase()] = value;
  });
  return out;
}

export async function recordCall(headers) {
  const doc = await readDoc("buffer:usage");
  const now = Date.now();
  const calls = [...(doc?.value?.calls || []), now].filter((t) => now - t < DAY).slice(-3000);
  const limits = limitHeaders(headers);
  await writeDoc("buffer:usage", { calls, limits: Object.keys(limits).length ? limits : doc?.value?.limits || null }, doc);
}

export async function usage() {
  const [doc, until] = await Promise.all([readDoc("buffer:usage"), blockedUntil()]);
  const now = Date.now();
  const calls = (doc?.value?.calls || []).filter((t) => now - t < DAY);
  return {
    last24h: calls.length,
    last15m: calls.filter((t) => now - t < 15 * 60000).length,
    limits: doc?.value?.limits || null,
    blockedUntil: until ? new Date(until).toISOString() : null,
  };
}

/* --- Cached reads ----------------------------------------------------------- */

export async function postsVersion() {
  return (await readDoc("buffer:posts-version"))?.value || 0;
}

/** Call after this app changes a post, so cached post lists are skipped. */
export async function bumpPosts() {
  const doc = await readDoc("buffer:posts-version");
  await writeDoc("buffer:posts-version", (doc?.value || 0) + 1, doc);
}

/**
 * The saved copy if it's younger than `ttlMs`, else a fresh one from
 * `compute`. If Buffer refuses (rate limit) and any copy exists, that copy
 * is returned instead of an error.
 */
export async function cachedRead(key, ttlMs, compute) {
  const full = `buffer:${key}`;
  if (state.inflight.has(full)) return state.inflight.get(full);
  const run = (async () => {
    const hit = await readDoc(full);
    if (hit && Date.now() - new Date(hit.updatedAt).getTime() < ttlMs) return hit.value;
    try {
      const value = await compute();
      await writeDoc(full, value, hit);
      return value;
    } catch (error) {
      if (hit && error.status === 429) return hit.value;
      throw error;
    }
  })().finally(() => state.inflight.delete(full));
  state.inflight.set(full, run);
  return run;
}

/** Tests only: forget blocks, counts and cached reads. */
export async function resetBudget() {
  state.blockedUntil = 0;
  state.inflight.clear();
  const docs = await cache().find({}).catch(() => []);
  await Promise.all(docs.filter((d) => String(d.key).startsWith("buffer:")).map((d) => cache().remove(d.id)));
}
