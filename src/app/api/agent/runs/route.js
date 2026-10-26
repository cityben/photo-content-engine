import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { startRun } from "@/lib/agent";

export const POST = route(async ({ request, user }) => {
  const { checks, useAi } = await readJson(request, z.object({ checks: z.array(z.string().max(40)).min(1).max(40), useAi: z.boolean().default(true) }));
  return { run: await startRun({ checks, useAi, user }) };
});
