import { getAutopilot, runAutopilot } from "@/lib/autopilot";
import { cronAuthorised } from "@/lib/cron-auth";

export const maxDuration = 300;

export async function GET(request) {
  if (!cronAuthorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const config = await getAutopilot();
  if (!config.enabled) return Response.json({ skipped: "Autopilot is switched off." });
  try {
    const run = await runAutopilot({ trigger: "schedule" });
    return Response.json({ ok: true, runId: run.id, drafts: run.drafts.length, cost: run.cost });
  } catch (error) {
    console.error("[cron] autopilot failed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
