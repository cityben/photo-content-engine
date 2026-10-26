import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { setAgentSchedule } from "@/lib/agent";

export const PUT = route(async ({ request, user }) => {
  const input = await readJson(request, z.object({ enabled: z.boolean(), preset: z.enum(["free", "weekly", "everything"]), useAi: z.boolean() }));
  return { schedule: await setAgentSchedule(input, user) };
});
