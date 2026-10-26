import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { isMonth, writeSummary } from "@/lib/reports";

export const maxDuration = 120;

export const POST = route(async ({ request, user }) => {
  const { month } = await readJson(request, z.object({ month: z.string().refine(isMonth, "Use YYYY-MM") }));
  return { report: await writeSummary(month, user) };
});
