import { readJson, route } from "@/lib/api";
import { getIdea, linkJob, targetFromIdea } from "@/lib/ideas";
import { createJob, listJobs } from "@/lib/jobs";
import { jobCreateSchema } from "@/lib/schemas";

export const GET = route(async () => ({ jobs: await listJobs() }));

export const POST = route(async ({ request, user }) => {
  const { ideaId, ...input } = await readJson(request, jobCreateSchema);
  const idea = ideaId ? await getIdea(ideaId) : null;
  const job = await createJob({ ...input, user, extra: idea ? { ideaId: idea.id, target: targetFromIdea(idea) } : {} });
  if (idea) await linkJob(idea.id, job.id);
  return { job };
});
