import { notFound, route } from "@/lib/api";
import { getRun } from "@/lib/agent";

export const GET = route(async ({ params }) => {
  const run = await getRun(params.id);
  if (!run) throw notFound("Run not found");
  return { run };
});
