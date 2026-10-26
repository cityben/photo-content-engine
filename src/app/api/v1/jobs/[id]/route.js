import { summarise } from "@/lib/integration";
import { requireIntegration } from "@/lib/integration-auth";
import { getJob } from "@/lib/jobs";

/** GET /api/v1/jobs/:id — status: approvals, scheduled posts, website draft. */
export async function GET(request, { params }) {
  const { response } = requireIntegration(request);
  if (response) return response;
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: { code: "not_found", message: "Job not found." } }, { status: 404 });
  return Response.json({ data: summarise(job, new URL(request.url).origin) });
}
