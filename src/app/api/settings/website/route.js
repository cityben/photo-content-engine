import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { checkWebsiteConnection, saveWebsiteConnection, websiteConfigPublic } from "@/lib/website-api";

const fields = {
  apiUrl: z.string().trim().max(500).optional(),
  apiKey: z.string().trim().max(500).optional(),
};

/** The saved connection — the key itself is never returned. */
export const GET = route(async () => ({ website: await websiteConfigPublic() }));

/** Save the address and/or key. An empty key keeps the saved one. */
export const PUT = route(async ({ request, user }) => {
  const input = await readJson(request, z.object({ ...fields, clearKey: z.boolean().optional() }));
  const website = await saveWebsiteConnection(input, user);
  return { website, check: await checkWebsiteConnection() };
});

/** Test values without saving them (blank fields use the saved ones). */
export const POST = route(async ({ request }) => {
  const input = await readJson(request, z.object(fields));
  return { check: await checkWebsiteConnection({ apiUrl: input.apiUrl || undefined, apiKey: input.apiKey || undefined }) };
});
