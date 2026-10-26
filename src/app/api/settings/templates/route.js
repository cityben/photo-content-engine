import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { getTemplates, saveTemplates } from "@/lib/template-store";
import { TEMPLATE_SECTIONS } from "@/lib/templates";

const one = z.object({ guide: z.string().max(2000).optional(), top: z.string().max(1000).optional(), bottom: z.string().max(1000).optional() });
const schema = z.object(Object.fromEntries(TEMPLATE_SECTIONS.map((s) => [s, one.optional()])));

export const GET = route(async () => ({ templates: await getTemplates() }));

/** Partial: only the sections sent are replaced. */
export const PUT = route(async ({ request, user }) => {
  const input = await readJson(request, schema);
  return { templates: await saveTemplates({ ...(await getTemplates()), ...input }, user) };
});
