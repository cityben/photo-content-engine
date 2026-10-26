import { readJson, route } from "@/lib/api";
import { runAutopilot } from "@/lib/autopilot";

import { autopilotSchema } from "../schema";

export const maxDuration = 300;

/** Run now, optionally with one-off settings (count, formats, planning). */
export const POST = route(async ({ request, user }) => {
  const overrides = await readJson(request, autopilotSchema);
  return { run: await runAutopilot({ ...overrides, user, trigger: "manual" }) };
});
