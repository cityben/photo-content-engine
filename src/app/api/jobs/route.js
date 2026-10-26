import { readJson, route } from "@/lib/api";
import { createJob, listJobs } from "@/lib/jobs";
import { jobInputSchema } from "@/lib/schemas";

export const GET = route(async () => ({ jobs: await listJobs() }));

export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, jobInputSchema);
  return { job: await createJob({ ...input, user }) };
});
