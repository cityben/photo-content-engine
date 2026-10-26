import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { addItem, listChecklist } from "@/lib/agent";

export const GET = route(async () => ({ checklist: await listChecklist() }));

export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, z.object({ title: z.string().trim().min(3).max(200), why: z.string().max(1000).optional() }));
  return { item: await addItem(input, user) };
});
