/**
 * The to-do list behind the bell: everything that needs a person, gathered
 * from the review queue, posting targets, the Focus checklist, lead
 * follow-ups and the content pipeline.
 *
 * Each item can be marked done or put off ("come back later"). Focus
 * checklist items keep that on the item itself; the rest are worked out
 * fresh each time, so a dismissal remembers the state it was dismissed in
 * (its fingerprint) and the item returns if that state changes — say a new
 * draft arrives after you cleared "3 drafts waiting".
 */

import { listChecklist, updateItem } from "@/lib/agent";
import { listIdeas } from "@/lib/ideas";
import { dueFollowUps, listLeads } from "@/lib/leads";
import { reviewQueue } from "@/lib/review";
import { collection } from "@/lib/store";
import { targetsData } from "@/lib/targets";

const states = () => collection("notification_state");
const RANK = { high: 0, medium: 1, low: 2 };

const n = (key, severity, title, detail, href, fingerprint, extra = {}) => ({ key, severity, title, detail, href, fingerprint: String(fingerprint ?? ""), ...extra });

/** Pure: notifications from already-loaded data. */
export function gather({ queue = [], targets = null, checklist = [], leads = [], ideas = [], today }) {
  const out = [];

  const toApprove = queue.filter((i) => i.state === "approve");
  if (toApprove.length) {
    const auto = toApprove.filter((i) => i.idea).length;
    out.push(n("review", "high", `${toApprove.length} ${toApprove.length === 1 ? "draft" : "drafts"} waiting for approval`, auto ? `${auto} from autopilot or the pipeline. Nothing goes out until you approve it.` : "Nothing goes out until you approve it.", "/review", toApprove.map((i) => i.key).sort().join(",")));
  }
  const ready = queue.filter((i) => i.state === "ready" && !i.blockers.length);
  if (ready.length) out.push(n("ready", "medium", `${ready.length} approved, not out yet`, "Schedule the posts and send the drafts to the website.", "/review?view=ready", ready.map((i) => i.key).sort().join(",")));

  for (const a of targets?.actions || []) {
    if (a.severity === "low") continue;
    out.push(n(`targets-${a.id}`, a.severity, a.title, a.detail, a.kind === "approve" ? `/jobs/${a.jobId}` : "/calendar", today));
  }

  for (const l of leads) {
    out.push(n(`lead-${l.id}`, l.nextFollowUp < today ? "high" : "medium", `Follow up ${l.name}`, `${l.nextFollowUp < today ? "Was due" : "Due"} ${l.nextFollowUp}. ${l.status === "contacted" ? "No reply yet." : ""}`.trim(), `/leads/${l.id}`, l.nextFollowUp));
  }

  for (const i of ideas.filter((x) => x.dueDate && x.dueDate < today && x.status !== "published")) {
    out.push(n(`idea-${i.id}`, "medium", `Overdue idea: “${i.title}”`, `Was due ${i.dueDate}.${i.jobId ? " The draft is waiting." : " Draft it or move the date."}`, i.jobId ? `/jobs/${i.jobId}` : "/ideas", i.dueDate));
  }

  for (const c of checklist.filter((x) => x.status === "open")) {
    out.push(n(`focus-${c.id}`, c.impact || "medium", c.title, c.why || "", c.href || "/focus", "", { focusId: c.id, snoozedUntil: c.snoozedUntil || null, recurred: Boolean(c.recurred) }));
  }
  return out;
}

/** Pure: drop done and snoozed items, most urgent first. */
export function visible(items, saved, now = new Date().toISOString()) {
  const byKey = new Map(saved.map((s) => [s.key, s]));
  return items
    .filter((item) => {
      if (item.snoozedUntil && item.snoozedUntil > now) return false;
      const s = byKey.get(item.key);
      if (!s) return true;
      if (s.until && s.until > now) return false;
      if (s.done && s.fingerprint === item.fingerprint) return false;
      return true;
    })
    .sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

async function safely(promise, fallback) {
  try {
    return await promise;
  } catch (error) {
    console.error("[notifications]", error.message);
    return fallback;
  }
}

export async function notifications() {
  const today = new Date().toISOString().slice(0, 10);
  const [queue, targets, checklist, leads, ideas, saved] = await Promise.all([
    safely(reviewQueue(), []),
    safely(targetsData(), null),
    safely(listChecklist(), []),
    safely(listLeads().then((l) => dueFollowUps(l, today)), []),
    safely(listIdeas(), []),
    safely(states().find({}), []),
  ]);
  const all = gather({ queue, targets, checklist, leads, ideas, today });
  const items = visible(all, saved);
  const now = new Date().toISOString();
  const until = new Map(saved.filter((x) => x.until).map((x) => [x.key, x.until]));
  const snoozed = all.filter((i) => (i.snoozedUntil && i.snoozedUntil > now) || until.get(i.key) > now).length;
  return { items, count: items.length, urgent: items.filter((i) => i.severity === "high").length, snoozed };
}

/** "later" values the bell offers, as an ISO time. */
export function snoozeUntil(later, now = new Date()) {
  const d = new Date(now);
  if (later === "hours") return new Date(d.getTime() + 3 * 3600000).toISOString();
  if (later === "tomorrow") {
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(7, 0, 0, 0);
    return d.toISOString();
  }
  if (later === "week") {
    const days = ((8 - d.getUTCDay()) % 7) || 7; // next Monday
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(7, 0, 0, 0);
    return d.toISOString();
  }
  throw new Error("Unknown snooze.");
}

export async function actOn({ key, fingerprint, action, later }, user) {
  // Focus checklist items: the state lives on the item.
  if (key.startsWith("focus-")) {
    const id = key.slice("focus-".length);
    if (action === "done") return updateItem(id, { status: "done" }, user);
    if (action === "snooze") return updateItem(id, { snoozedUntil: snoozeUntil(later) }, user);
    if (action === "restore") return updateItem(id, { snoozedUntil: null }, user);
  }
  const [existing] = await states().find({ key });
  const record =
    action === "done"
      ? { key, done: true, fingerprint: fingerprint || "", until: null, by: user?.email || null }
      : action === "snooze"
        ? { key, done: false, fingerprint: "", until: snoozeUntil(later), by: user?.email || null }
        : null;
  if (!record) {
    if (existing) await states().remove(existing.id);
    return null;
  }
  return existing ? states().update(existing.id, record) : states().insert(record);
}
