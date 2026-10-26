import { PageHeader } from "@/components/shell/app-shell";
import { FORMATS, listIdeas, SOURCES, STAGES } from "@/lib/ideas";
import { listJobs } from "@/lib/jobs";

import { Board } from "./board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Content pipeline — Content Engine" };

export default async function IdeasPage() {
  const [ideas, jobs] = await Promise.all([listIdeas(), listJobs()]);
  const aiReady = Boolean(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
  return (
    <>
      <PageHeader
        title="Content pipeline"
        description="What to make next and why. Ideas come from what your market searches for, competitor gaps, questions people ask AI assistants, and the team. Start a job from an idea and it writes towards that search."
      />
      <Board
        initialIdeas={ideas}
        jobs={Object.fromEntries(jobs.map((j) => [j.id, true]))}
        stages={STAGES}
        formats={FORMATS}
        sources={SOURCES}
        aiReady={aiReady}
      />
    </>
  );
}
