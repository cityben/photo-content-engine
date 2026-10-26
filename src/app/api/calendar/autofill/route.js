import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { applyAutofill, planAutofill } from "@/lib/autofill";

export const maxDuration = 60;

export const POST = route(async ({ request }) => {
  const { apply } = await readJson(request, z.object({ apply: z.boolean().default(false) }));
  return apply ? { results: await applyAutofill() } : { plan: await planAutofill() };
});
