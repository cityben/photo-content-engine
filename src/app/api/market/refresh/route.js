import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { cleanDomain, isValidDomain } from "@/lib/seo/analysis";
import { REFRESHERS } from "@/lib/seo/market";
import { PRESENCE_REFRESHERS } from "@/lib/seo/presence";

export const maxDuration = 300;

const ALL = { ...REFRESHERS, ...PRESENCE_REFRESHERS };

const schema = z.object({
  section: z.enum(Object.keys(ALL)),
  domain: z.string().max(253).transform(cleanDomain).refine(isValidDomain, "Not a domain").optional(),
  keywords: z.array(z.string().max(100)).max(5).optional(),
});

export const POST = route(async ({ request }) => {
  const input = await readJson(request, schema);
  if ((input.section === "ranked" || input.section === "gap") && !input.domain) throw new Error("Pick a domain.");
  const snap = await ALL[input.section](input);
  return {
    cost: snap.cost,
    rows: Array.isArray(snap.data) ? snap.data.length : null,
    pending: snap.pending || false,
    ...(input.section === "collect" && snap.data),
    at: snap.createdAt,
  };
});
