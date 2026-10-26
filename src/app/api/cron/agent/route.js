import { timingSafeEqual } from "node:crypto";

import { getAgentSchedule, PRESETS, runAll } from "@/lib/agent";

export const maxDuration = 300;

// Vercel Cron calls this (vercel.json) with "Authorization: Bearer $CRON_SECRET".
function authorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const schedule = await getAgentSchedule();
  if (!schedule.enabled) return Response.json({ skipped: "The weekly growth check is switched off." });
  try {
    const run = await runAll({ checks: PRESETS[schedule.preset].checks, useAi: schedule.useAi });
    return Response.json({ ok: true, runId: run.id, findings: run.findingsCount, cost: run.cost });
  } catch (error) {
    console.error("[cron] growth check failed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
