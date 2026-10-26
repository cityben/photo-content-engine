import { notFound, readJson, route } from "@/lib/api";
import { deleteJob, getJob, updateJob } from "@/lib/jobs";
import { contentPatchSchema, jobInputSchema } from "@/lib/schemas";

export const GET = route(async ({ params }) => {
  const job = await getJob(params.id);
  if (!job) throw notFound("Job not found");
  return { job };
});

const patchSchema = jobInputSchema.extend({ content: contentPatchSchema.optional() });

export const PATCH = route(async ({ request, params }) => {
  const job = await getJob(params.id);
  if (!job) throw notFound("Job not found");
  const input = await readJson(request, patchSchema);
  const patch = { ...input };
  if (input.content) patch.content = { ...job.content, ...input.content };
  if (input.details) patch.details = { ...job.details, ...input.details };
  return { job: await updateJob(params.id, patch) };
});

export const DELETE = route(async ({ params }) => {
  if (!(await deleteJob(params.id))) throw notFound("Job not found");
  return { ok: true };
});

export const dynamic = "force-dynamic";
