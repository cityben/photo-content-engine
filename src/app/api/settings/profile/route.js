import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { getProfile, saveProfile } from "@/lib/profile";

export const GET = route(async () => ({ profile: await getProfile() }));

// Validated and trimmed in cleanProfile(); the shape is checked loosely here.
export const PUT = route(async ({ request, user }) => {
  const input = await readJson(request, z.object({ profile: z.record(z.string(), z.any()) }));
  return { profile: await saveProfile(input.profile, user) };
});
