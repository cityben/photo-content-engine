import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { isValidModelId, modelCatalog, setActiveModel } from "@/lib/models";

export const GET = route(async () => ({ catalog: await modelCatalog() }));

export const PUT = route(async ({ request, user }) => {
  const { model } = await readJson(request, z.object({ model: z.string().refine(isValidModelId, "Unknown model id") }));
  const { shortlist, others, error } = await modelCatalog();
  const known = shortlist.some((m) => m.id === model) || others.some((m) => m.id === model);
  if (!known && !error) throw new Error("That model isn't available on the AI Gateway.");
  await setActiveModel(model, user);
  return { model };
});
