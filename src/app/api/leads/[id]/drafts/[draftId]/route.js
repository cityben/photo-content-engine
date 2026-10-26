import { z } from "zod";

import { notFound, readJson, route } from "@/lib/api";
import { approveDraft, editDraft } from "@/lib/leads";

const schema = z.union([z.object({ approved: z.boolean() }), z.object({ subject: z.string().min(1).max(200).optional(), body: z.string().min(1).max(5000).optional() })]);

export const PATCH = route(async ({ request, params, user }) => {
  const input = await readJson(request, schema);
  const lead = "approved" in input ? await approveDraft(params.id, params.draftId, input.approved, user) : await editDraft(params.id, params.draftId, input, user);
  if (!lead) throw notFound("Draft not found");
  return { lead };
});
