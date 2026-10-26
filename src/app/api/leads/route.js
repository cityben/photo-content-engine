import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { addLeads, latestSearch, listLeads } from "@/lib/leads";
import { cleanDomain } from "@/lib/seo/analysis";

export const GET = route(async () => ({ leads: await listLeads() }));

// Either cids from the latest search (rows are taken from the stored
// search, not from the browser), or one business typed in by hand.
const schema = z.union([
  z.object({ cids: z.array(z.string().max(40)).min(1).max(100) }),
  z.object({
    manual: z.object({
      name: z.string().trim().min(2).max(200),
      category: z.string().max(120).optional(),
      website: z.string().url().max(500).optional().or(z.literal("")),
      phone: z.string().max(40).optional(),
      address: z.string().max(300).optional(),
    }),
  }),
]);

export const POST = route(async ({ request, user }) => {
  const input = await readJson(request, schema);
  if (input.manual) {
    const m = input.manual;
    return addLeads([{ ...m, website: m.website || null, domain: m.website ? cleanDomain(m.website) : null, cid: null, categoryIds: [], reviews: 0, rating: null, fit: null, source: "manual" }], user);
  }
  const search = await latestSearch();
  const rows = (search?.data?.rows || []).filter((r) => input.cids.includes(r.cid));
  if (!rows.length) throw new Error("Those businesses aren't in the latest search. Search again.");
  return addLeads(rows, user);
});
