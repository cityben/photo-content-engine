import { getAgentSchedule, PRESETS, runAll } from "@/lib/agent";
import { cronAuthorised } from "@/lib/cron-auth";

export const maxDuration = 300;

export async function GET(request) {
  if (!cronAuthorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
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
