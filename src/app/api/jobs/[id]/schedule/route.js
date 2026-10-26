import { readJson, route } from "@/lib/api";
import { scheduleForJob } from "@/lib/jobs";
import { scheduleSchema } from "@/lib/schemas";

export const POST = route(async ({ request, params }) => {
  const input = await readJson(request, scheduleSchema);
  return { post: await scheduleForJob(params.id, input) };
});
