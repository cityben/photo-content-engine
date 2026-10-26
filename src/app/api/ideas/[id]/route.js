import { notFound, readJson, route } from "@/lib/api";
import { deleteIdea, getIdea, updateIdea } from "@/lib/ideas";

import { ideaPatchSchema } from "../schema";

export const PATCH = route(async ({ request, params }) => {
  if (!(await getIdea(params.id))) throw notFound("Idea not found");
  const input = await readJson(request, ideaPatchSchema);
  return { idea: await updateIdea(params.id, input) };
});

export const DELETE = route(async ({ params }) => {
  if (!(await deleteIdea(params.id))) throw notFound("Idea not found");
  return { ok: true };
});
