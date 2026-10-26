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
        description="What to make next and why. Draft an idea with AI, or start a job from it."
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
