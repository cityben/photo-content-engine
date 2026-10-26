/**
 * Auto-fill: put every approved, unscheduled post into the next free
 * publishing slot for its channel. Preview first, then apply.
 */

import { readyToSchedule, scheduleForJob } from "@/lib/jobs";
import { getSchedule } from "@/lib/schedule";
import { listChannels, listPosts } from "@/lib/social";
import { nextQueueSlot } from "@/lib/time";

export async function planAutofill() {
  const [items, channels, schedule] = await Promise.all([readyToSchedule(), listChannels(), getSchedule()]);
  const booked = await listPosts({
    start: new Date().toISOString(),
    end: new Date(Date.now() + 120 * 86400000).toISOString(),
    statuses: ["scheduled", "sending"],
  });

  const taken = new Map(); // channelId → ISO times
  for (const p of booked) taken.set(p.channelId, [...(taken.get(p.channelId) || []), p.dueAt]);

  const plan = [];
  for (const item of items) {
    const channel = channels.find((c) => c.service === item.service && !c.disconnected);
    if (!channel) {
      plan.push({ ...item, channelId: null, dueAt: null, problem: `No ${item.service} channel connected` });
      continue;
    }
    const times = taken.get(channel.id) || [];
    const due = nextQueueSlot(new Date(), times, undefined, schedule[item.service]).toISOString();
    taken.set(channel.id, [...times, due]);
    plan.push({ ...item, channelId: channel.id, channelName: channel.name, dueAt: due });
  }
  return plan;
}

export async function applyAutofill() {
  const plan = await planAutofill();
  const results = [];
  for (const item of plan) {
    if (!item.channelId) {
      results.push({ ...item, ok: false, error: item.problem });
      continue;
    }
    try {
      const post = await scheduleForJob(item.jobId, { channelId: item.channelId, dueAt: item.dueAt });
      results.push({ ...item, ok: true, postId: post.id });
    } catch (error) {
      results.push({ ...item, ok: false, error: error.message });
    }
  }
  return results;
}
