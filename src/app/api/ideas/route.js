import { readJson, route } from "@/lib/api";
import { createIdea, listIdeas } from "@/lib/ideas";

import { ideaSchema } from "./schema";

export const GET = route(async () => ({ ideas: await listIdeas() }));

export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, ideaSchema);
  return createIdea(input, user);
});
