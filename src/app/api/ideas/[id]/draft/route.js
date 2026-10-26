import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { AUTOPILOT_FORMATS, draftFromIdea, getAutopilot } from "@/lib/autopilot";
import { getIdea } from "@/lib/ideas";

export const maxDuration = 120;

const schema = z.object({ formats: z.array(z.enum(Object.keys(AUTOPILOT_FORMATS))).min(1).optional() });

/** One idea → blog post and posts, written by AI, waiting for review. */
export const POST = route(async ({ request, params, user }) => {
  const body = await readJson(request, schema);
  const config = await getAutopilot();
  const { job, error } = await draftFromIdea(params.id, { formats: body.formats || config.formats, photos: config.photos, user });
  return { job, error, idea: await getIdea(params.id) };
});
