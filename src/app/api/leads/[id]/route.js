import { z } from "zod";

import { notFound, readJson, route } from "@/lib/api";
import { deleteLead, getLead, LEAD_STAGE_IDS, updateLead } from "@/lib/leads";

const schema = z.object({
  status: z.enum(LEAD_STAGE_IDS).optional(),
  contact: z.object({ name: z.string().max(120).optional(), role: z.string().max(120).optional(), email: z.string().email().max(200).optional().or(z.literal("")) }).optional(),
  notes: z.string().max(5000).optional(),
  note: z.string().trim().min(1).max(2000).optional(),
  nextFollowUp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const GET = route(async ({ params }) => {
  const lead = await getLead(params.id);
  if (!lead) throw notFound("Lead not found");
  return { lead };
});

export const PATCH = route(async ({ request, params, user }) => {
  const input = await readJson(request, schema);
  const lead = await updateLead(params.id, input, user);
  if (!lead) throw notFound("Lead not found");
  return { lead };
});

export const DELETE = route(async ({ params }) => {
  if (!(await deleteLead(params.id))) throw notFound("Lead not found");
  return { ok: true };
});
