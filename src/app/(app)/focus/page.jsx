import { PageHeader } from "@/components/shell/app-shell";
import { catalogue, getAgentSchedule, listChecklist, listRuns } from "@/lib/agent";

import { FocusClient } from "./focus-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Focus — Content Engine" };

export default async function FocusPage() {
  const [cat, runs, checklist, schedule] = await Promise.all([catalogue(), listRuns(), listChecklist(), getAgentSchedule()]);
  return (
    <>
      <PageHeader
        title="Focus"
        description="Run a check across everything, get one list of what to fix next."
      />
      <FocusClient data={{ ...cat, runs, checklist, schedule }} cronReady={Boolean(process.env.CRON_SECRET)} />
    </>
  );
}
