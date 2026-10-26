import { z } from "zod";

import { extractCaseStudyFromDocument } from "@/lib/ai";
import { readJson, route } from "@/lib/api";
import { asList, completeness, normaliseCaseStudy } from "@/lib/case-study-fields";
import { matchOption } from "@/lib/docx-map";
import { allServices, getOptions } from "@/lib/profile";

export const maxDuration = 120;

const schema = z.object({
  text: z.string().trim().min(40, "The document has hardly any text.").max(200000),
  known: z.record(z.string(), z.any()).optional(),
});

/** Known values (form, or another system) are facts: they replace the AI's. */
function applyKnown(cs, known = {}, options) {
  const out = { ...cs };
  const has = (v) => (Array.isArray(v) ? v.length : v != null && String(v).trim() !== "");
  for (const k of ["title", "client", "area", "county", "postcode"]) if (has(known[k])) out[k] = String(known[k]).trim();
  const lists = { company: options.companies, sector: options.sectors, projectType: options.projectTypes, services: allServices(options) };
  for (const [k, list] of Object.entries(lists)) {
    if (!has(known[k])) continue;
    const matched = asList(known[k]).map((v) => matchOption(String(v), list)).filter(Boolean);
    if (matched.length) out[k] = [...new Set(matched)];
  }
  if (has(known.durationWeeks) && Number(known.durationWeeks)) out.durationWeeks = Number(known.durationWeeks);
  if (has(known.location) && !has(known.area) && !has(known.county)) {
    const parts = String(known.location).split(",").map((s) => s.trim()).filter(Boolean);
    out.area = parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0];
    if (parts.length > 1) out.county = parts.at(-1);
  }
  return normaliseCaseStudy(out);
}

export const POST = route(async ({ request }) => {
  const { text, known } = await readJson(request, schema);
  const { result, run } = await extractCaseStudyFromDocument({ text, known });
  const caseStudy = applyKnown(result.caseStudy, known, await getOptions());
  return { ...result, caseStudy, completeness: completeness(caseStudy), run };
});
