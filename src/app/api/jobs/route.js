import { readJson, route } from "@/lib/api";
import { createJob, listJobs } from "@/lib/jobs";
import { jobCreateSchema } from "@/lib/schemas";

export const GET = route(async () => ({ jobs: await listJobs() }));

export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, jobCreateSchema);
  return { job: await createJob({ ...input, user }) };
});
