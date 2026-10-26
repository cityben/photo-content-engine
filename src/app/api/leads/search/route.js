import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { AREA_PRESETS, searchBusinesses } from "@/lib/leads";

export const maxDuration = 120;

export const POST = route(async ({ request }) => {
  const input = await readJson(
    request,
    z.object({
      areaId: z.enum(AREA_PRESETS.map((a) => a.id)),
      radiusKm: z.number().min(1).max(100).default(10),
      categories: z.array(z.string().regex(/^[a-z_]{2,80}$/, "Use a Google category id like property_management_company")).max(10).default([]),
      keyword: z.string().max(200).optional(),
      minReviews: z.number().int().min(0).max(10000).default(0),
    })
  );
  const snap = await searchBusinesses(input);
  return { cost: snap.cost, rows: snap.data.rows.length, total: snap.data.total };
});
