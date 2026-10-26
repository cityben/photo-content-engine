import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { actOn, notifications } from "@/lib/notifications";

export const GET = route(async () => notifications());

const schema = z.object({
  key: z.string().min(1).max(200),
  fingerprint: z.string().max(5000).optional(),
  action: z.enum(["done", "snooze", "restore"]),
  later: z.enum(["hours", "tomorrow", "week"]).optional(),
});

export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, schema);
  if (input.action === "snooze" && !input.later) throw new z.ZodError([{ code: "custom", path: ["later"], message: "Say when to come back" }]);
  await actOn(input, user);
  return notifications();
});
