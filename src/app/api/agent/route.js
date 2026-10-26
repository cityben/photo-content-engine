import { route } from "@/lib/api";
import { catalogue, getAgentSchedule, listChecklist, listRuns } from "@/lib/agent";

/** Checks with cost estimates, recent runs, the checklist and the schedule. */
export const GET = route(async () => {
  const [cat, runs, checklist, schedule] = await Promise.all([catalogue(), listRuns(), listChecklist(), getAgentSchedule()]);
  return { ...cat, runs, checklist, schedule };
});
