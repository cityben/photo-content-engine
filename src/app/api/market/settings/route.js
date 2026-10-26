import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { cleanDomain, isValidDomain } from "@/lib/seo/analysis";
import { getMarketSettings, setMarketSettings } from "@/lib/seo/market";

const domain = z.string().max(253).transform(cleanDomain).refine(isValidDomain, "Not a domain");

export const GET = route(async () => ({ settings: await getMarketSettings() }));

export const PUT = route(async ({ request, user }) => {
  const input = await readJson(
    request,
    z.object({
      domain: domain.optional(),
      competitors: z.array(domain).max(15).optional(),
      seeds: z.array(z.string().min(2).max(80)).max(50).optional(),
      brand: z.string().min(2).max(80).optional(),
      location: z.string().min(2).max(120).optional(),
      rivals: z.array(z.string().min(2).max(80)).max(8).optional(),
      auditUrls: z.array(z.string().url().max(500).refine((u) => u.startsWith("https://"), "Use an https:// address")).max(10).optional(),
    })
  );
  return { settings: await setMarketSettings(input, user) };
});
