import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { latestInsights, refreshInsights } from "@/lib/growth";

export const maxDuration = 90;

export const GET = route(async () => ({ insights: await latestInsights() }));

export const POST = route(async ({ request, user }) => {
  const { days } = await readJson(request, z.object({ days: z.number().int().min(7).max(90).default(30) }));
  return { insights: await refreshInsights({ days, user }) };
});
