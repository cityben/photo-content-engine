import { z } from "zod";

import { generateOutreach } from "@/lib/ai";
import { notFound, readJson, route } from "@/lib/api";
import { listJobs } from "@/lib/jobs";
import { addDraft, getLead, relevantJobs } from "@/lib/leads";

export const maxDuration = 60;

export const POST = route(async ({ request, params, user }) => {
  const input = await readJson(
    request,
    z.object({ kind: z.enum(["intro", "follow-up"]).default("intro"), instructions: z.string().max(1000).optional(), manual: z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(5000) }).optional() })
  );
  const lead = await getLead(params.id);
  if (!lead) throw notFound("Lead not found");
  if (input.manual) return { lead: await addDraft(params.id, input.manual, user) };
  const previous = lead.drafts?.find((d) => d.sentAt);
  const { draft, run } = await generateOutreach(lead, { jobs: relevantJobs(lead, await listJobs()), kind: input.kind, instructions: input.instructions, previous });
  return { lead: await addDraft(params.id, { ...draft, model: run.model, costUsd: run.costUsd }, user) };
});
