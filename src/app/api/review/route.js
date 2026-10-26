import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { APPROVABLE } from "@/lib/content";
import { reviewAction, reviewQueue } from "@/lib/review";

export const maxDuration = 60;

const schema = z.object({
  jobId: z.string().min(1).max(100),
  section: z.enum(APPROVABLE),
  action: z.enum(["approve", "unapprove", "schedule", "send", "posted"]),
  channelId: z.string().max(200).optional(),
});

export const GET = route(async () => ({ items: await reviewQueue() }));

export const POST = route(async ({ request, user }) => {
  const result = await reviewAction(await readJson(request, schema), user);
  return { ...result, items: await reviewQueue() };
});
