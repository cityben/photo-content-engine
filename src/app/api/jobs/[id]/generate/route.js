import { z } from "zod";

import { SECTIONS } from "@/lib/ai";
import { readJson, route } from "@/lib/api";
import { generateForJob } from "@/lib/jobs";

// One vision call that writes every section; allow time for it.
export const maxDuration = 120;

const schema = z.object({
  sections: z.array(z.enum(SECTIONS)).min(1).optional(),
  instructions: z.string().max(1000).optional(),
});

export const POST = route(async ({ request, params }) => {
  const input = await readJson(request, schema);
  return { job: await generateForJob(params.id, input) };
});
