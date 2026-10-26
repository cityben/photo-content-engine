import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { getSchedule, setSchedule } from "@/lib/schedule";

const entry = z.object({
  days: z.array(z.number().int().min(0).max(6)).max(7),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(8),
});

export const GET = route(async () => ({ schedule: await getSchedule() }));

export const PUT = route(async ({ request, user }) => {
  const { schedule } = await readJson(request, z.object({ schedule: z.object({ linkedin: entry, instagram: entry }) }));
  return { schedule: await setSchedule(schedule, user) };
});
