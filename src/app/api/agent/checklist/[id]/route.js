import { z } from "zod";

import { notFound, readJson, route } from "@/lib/api";
import { deleteItem, updateItem } from "@/lib/agent";

export const PATCH = route(async ({ request, params, user }) => {
  const input = await readJson(request, z.object({ status: z.enum(["open", "done", "dismissed"]) }));
  const item = await updateItem(params.id, input, user);
  if (!item) throw notFound("Item not found");
  return { item };
});

export const DELETE = route(async ({ params }) => {
  if (!(await deleteItem(params.id))) throw notFound("Item not found");
  return { ok: true };
});
