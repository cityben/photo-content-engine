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
        description="One run through everything — posting, approvals, case studies, pipeline, leads, search, traffic, competitors and reputation — and one list of what to do about it."
      />
      <FocusClient data={{ ...cat, runs, checklist, schedule }} cronReady={Boolean(process.env.CRON_SECRET)} />
    </>
  );
}
