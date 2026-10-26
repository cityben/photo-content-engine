/**
 * Publishing schedule: which days and times each channel posts on.
 * "Next slot" and auto-fill use it (in sandbox and with Buffer alike — the
 * app picks the time and books it), and the calendar shades the rest.
 */

import { collection } from "@/lib/store";
import { DEFAULT_DAYS, nextQueueSlot, QUEUE_SLOTS } from "@/lib/time";

export const DEFAULT_SCHEDULE = {
  linkedin: { days: [2, 3, 4], times: ["08:30", "12:30"] },
  instagram: { days: [1, 3, 5], times: ["12:30", "18:00"] },
};

const settings = () => collection("settings");

function clean(entry) {
  const days = [...new Set((entry?.days || []).map(Number).filter((d) => d >= 0 && d <= 6))].sort();
  const times = [...new Set((entry?.times || []).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort();
  return { days: days.length ? days : DEFAULT_DAYS, times: times.length ? times : QUEUE_SLOTS };
}

export async function getSchedule() {
  try {
    const [doc] = await settings().find({ key: "publishing-schedule" });
    const saved = doc?.value || {};
    return Object.fromEntries(Object.keys(DEFAULT_SCHEDULE).map((s) => [s, clean(saved[s] || DEFAULT_SCHEDULE[s])]));
  } catch (error) {
    console.error("[schedule] read failed:", error.message);
    return DEFAULT_SCHEDULE;
  }
}

export async function setSchedule(schedule, user) {
  const value = Object.fromEntries(Object.keys(DEFAULT_SCHEDULE).map((s) => [s, clean(schedule[s])]));
  const [doc] = await settings().find({ key: "publishing-schedule" });
  const record = { key: "publishing-schedule", value, updatedBy: user?.email || null };
  if (doc) await settings().update(doc.id, record);
  else await settings().insert(record);
  return value;
}

/** Next free slot for a channel, given the posts already booked on it. */
export async function nextSlotFor(service, takenIso, after = new Date()) {
  const schedule = await getSchedule();
  return nextQueueSlot(after, takenIso, undefined, schedule[service]);
}
