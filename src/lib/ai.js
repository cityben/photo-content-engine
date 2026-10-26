/**
 * AI writing via the Vercel AI Gateway (AI SDK). Model strings such as
 * "anthropic/claude-sonnet-5.5" route through the gateway; auth is
 * AI_GATEWAY_API_KEY locally or the project's OIDC token on Vercel.
 *
 * Every call returns typed objects (Output.object + zod), so the UI never has
 * to parse loose JSON.
 */

import { generateText, Output } from "ai";
import { z } from "zod";

import options from "@/data/website-options.json";
import { asList, normaliseCaseStudy, serviceLinksFor } from "@/lib/case-study-fields";
import { getStoredImage } from "@/lib/media";
import { getActiveModel, runCost } from "@/lib/models";

const ALL_SERVICES = options.serviceGroups.flatMap((g) => g.services);

const VOICE = `You write for Acme Ltd, a privately-owned building services group trading since 2017 across London, Kent and the South East. Four divisions: Air Conditioning, Mechanical, Electrical, Facilities Management — one accountable contractor. Audience: facilities managers, building owners, main contractors and fit-out project managers. They are technical and sceptical.

Voice: UK English. Active, terse, concrete. Name real kit, real deliverables (commissioning records, O&M manuals, F-Gas certificates, PPM schedules) where the job involves them. No hype. Never use: "seamless", "cutting-edge", "one-stop solution", "elevate", "unlock", "game-changer", "state-of-the-art".

Facts: use only what the photos and the write-up show. Never invent client names, figures, durations, savings, dates or certifications. If something isn't known, leave it out or leave the field empty.`;

/* --- Schemas ------------------------------------------------------------- */

const linkedinSchema = z.object({
  text: z.string().describe("LinkedIn post, 120-220 words. Line 1 is a hook under 140 characters that works before 'see more'. Short paragraphs. End with one clear call to action. Hashtags NOT included here."),
  hashtags: z.array(z.string()).describe("3-5 hashtags, most specific first, each starting with #"),
  firstComment: z.string().describe("First comment to post underneath: link placeholder {{case_study_url}} plus one line of context. Empty if not useful."),
});

const instagramSchema = z.object({
  caption: z.string().describe("Instagram caption, 60-150 words. Strong first line. Conversational but professional. Up to 4 relevant emojis. Hashtags NOT included here."),
  hashtags: z.array(z.string()).describe("10-20 hashtags mixing niche trade tags, London/Kent location tags and a branded tag; each starts with #"),
  firstComment: z.string().describe("Optional first comment. Empty string if not needed."),
  altText: z.string().describe("Accessibility alt text for the main photo, under 200 characters, describing the work shown"),
});

const caseStudySchema = z.object({
  template: z.enum(["simple", "full"]).describe("'full' when there are real challenges or delivery highlights to tell; otherwise 'simple'"),
  title: z.string().describe("Job name, specific: what was done, where. Under 70 characters, e.g. 'Rochester Office CAT-B Fit-out'."),
  description: z.string().describe("Short summary, 1-2 sentences, under 300 characters. Shown on cards and in Google results."),
  company: z.array(z.enum(options.companies)).describe("Every company that delivered the job"),
  sector: z.array(z.enum(options.sectors)).describe("Project sector(s) — any that apply"),
  projectType: z.array(z.enum(options.projectTypes)).describe("Type(s) of project — any that apply"),
  services: z.array(z.string()).describe(`Services delivered, copied EXACTLY from this list (these decide which service pages show the case study): ${ALL_SERVICES.join(" | ")}`),
  client: z.string().describe("Client or building name only if stated, else empty"),
  area: z.string().describe("Town or borough, e.g. 'Rochester', else empty"),
  county: z.string().describe("Borough / county, e.g. 'Kent' or 'London', else empty"),
  postcode: z.string().describe("UK postcode only if stated (places the map pin), else empty"),
  durationWeeks: z.number().int().nullable().describe("Project duration in whole weeks only if stated or clearly derivable from stated dates, else null"),
  scopeOfWorks: z.string().describe("Markdown. What the job involved: 2-5 bullets or a short paragraph."),
  keyWorks: z.string().describe("Markdown bullets: the main works carried out (shown on the Simple template)."),
  keyChallenges: z.string().describe("Markdown: real challenges and how they were solved (Full template). Empty if none known."),
  deliveryHighlights: z.string().describe("Markdown: delivery highlights — programme, access, live-building working, H&S, handover documents (Full template). Empty if none known."),
  projectOutcome: z.string().describe("Markdown: the outcome and results for the client. No invented figures."),
  testimonialQuote: z.string().describe("A client quote only if one is given word for word, else empty"),
  testimonialAuthor: z.string().describe("Who said it, if given, else empty"),
  testimonialRole: z.string().describe("Their role / company, if given, else empty"),
  seoTitle: z.string().describe("Title tag, 50-60 characters, primary keyword near the start, e.g. 'Commercial HVAC & VRF Replacement Maidenhead | Acme Ltd'"),
  metaDescription: z.string().describe("Meta description, 140-155 characters, includes the primary keyword and location"),
  seoH1: z.string().describe("Recommended H1, e.g. 'TOR Building, Maidenhead: CAT-B Office HVAC and VRF Replacement'"),
  primaryKeyword: z.string().describe("Single primary keyword phrase, e.g. 'commercial HVAC replacement Maidenhead'"),
  supportingKeywords: z.string().describe("4-8 supporting keywords separated with semicolons"),
  mainImageAlt: z.string().describe("Alt text for the main project photo, e.g. 'Mitsubishi Electric VRF installation at TOR Building in Maidenhead'"),
  seoNotes: z.string().describe("Internal publishing notes (never shown on the site): facts to confirm before publishing, and anything left out because it wasn't known"),
});

const keywordSchema = z.object({
  keyword: z.string(),
  intent: z.enum(["commercial", "local", "informational", "navigational"]),
  priority: z.enum(["high", "medium", "low"]),
  why: z.string().describe("Why this keyword is worth targeting, citing Search Console figures when provided (position, impressions, CTR)"),
  useIn: z.string().describe("Where to use it: case study title, H1, LinkedIn hook, Instagram caption, GBP post, a new service page…"),
  evidence: z.enum(["search-console", "estimate"]).describe("search-console if backed by the provided real data, otherwise estimate"),
});

const seoSchema = z.object({
  keywords: z.array(keywordSchema).describe("6-10 keyword opportunities, highest priority first"),
  rankingNotes: z.string().describe("Plain-English explanation of why the site ranks (or doesn't) for the related queries, based on the Search Console data if provided. If no data was provided, say it's an estimate."),
  internalLinks: z.array(z.string()).describe("2-4 suggested internal links as 'anchor text → /path' using the website's service pages"),
});

const recommendationSchema = z.object({
  title: z.string().describe("Short imperative, e.g. 'Post the LinkedIn version Tuesday 08:30'"),
  detail: z.string().describe("2-4 sentences: what to do and why it helps, specific to this job"),
  category: z.enum(["timing", "content", "seo", "engagement", "growth", "website", "photos"]),
  impact: z.enum(["high", "medium", "low"]),
});

const googleBusinessSchema = z.object({
  text: z.string().describe("Google Business Profile 'What's new' post, 80-150 words, local and specific, ends with a call to action. No hashtags."),
});

export const SECTION_SCHEMAS = {
  linkedin: linkedinSchema,
  instagram: instagramSchema,
  caseStudy: caseStudySchema,
  googleBusiness: googleBusinessSchema,
  seo: seoSchema,
  recommendations: z.array(recommendationSchema).describe("5-8 specific, actionable recommendations to get the most reach, engagement, enquiries and search traffic from THIS job"),
};

export const SECTIONS = Object.keys(SECTION_SCHEMAS);

/* --- Inputs -------------------------------------------------------------- */

async function imagePart(image) {
  if (image.url.startsWith("/api/media/")) {
    const stored = await getStoredImage(image.url.split("/").pop());
    if (!stored) return null;
    return { type: "image", image: new Uint8Array(stored.bytes), mediaType: stored.contentType };
  }
  const res = await fetch(image.url);
  if (!res.ok) return null;
  return {
    type: "image",
    image: new Uint8Array(await res.arrayBuffer()),
    mediaType: res.headers.get("content-type") || "image/jpeg",
  };
}

function describeJob(job) {
  const d = job.details || {};
  const lines = [
    `Job title: ${job.title || "(not given)"}`,
    d.company && `Division: ${d.company}`,
    d.sector && `Sector: ${d.sector}`,
    d.projectType && `Project type: ${d.projectType}`,
    d.services?.length && `Services: ${d.services.join(", ")}`,
    d.location && `Location: ${d.location}`,
    d.client && `Client / building: ${d.client}`,
    d.completedOn && `Completed: ${d.completedOn}`,
    job.target?.keyword &&
      `Target search: "${job.target.keyword}"${job.target.volume ? ` (${job.target.volume} UK searches/month)` : ""}. Use this exact phrase naturally in the case study title or summary, the SEO keywords and at least one post — never stuffed.`,
    job.target?.angle && `Planned angle: ${job.target.angle}`,
    "",
    "Write-up from the team:",
    job.writeUp?.trim() || "(none — rely on the photos)",
  ];
  return lines.filter((l) => l !== undefined && l !== false && l !== null).join("\n");
}

function describeSearchData(searchData) {
  if (!searchData?.rows?.length) {
    return "No Search Console data is connected. Keyword figures are your estimates — mark evidence as 'estimate'.";
  }
  const rows = searchData.rows
    .slice(0, 60)
    .map((r) => `${r.key} | clicks ${r.clicks} | impr ${r.impressions} | ctr ${r.ctr != null ? (r.ctr * 100).toFixed(1) + "%" : "-"} | pos ${r.position != null ? r.position.toFixed(1) : "-"}${r.positionChange != null ? ` (${r.positionChange >= 0 ? "+" : ""}${r.positionChange.toFixed(1)})` : ""}`)
    .join("\n");
  return `Real Google Search Console data for example.co.uk, last 90 days (query | clicks | impressions | CTR | average position (change vs previous period, + is better)):
${rows}

Use this to pick keywords the site already gets impressions for but ranks 4-20 (quick wins), and explain ranking in plain English.`;
}

/**
 * Generate content for a job. `sections` limits which parts are written
 * (default: all). `searchData` is the website's Search Console report, if
 * connected. `instructions` lets the user steer a rewrite. `model` overrides
 * the chosen model for this run (to compare models on the same job).
 *
 * Returns { content, run } — run records model, tokens and cost.
 */
export async function generateJobContent(job, { sections = SECTIONS, searchData, instructions, current, model } = {}) {
  const wanted = sections.filter((s) => SECTION_SCHEMAS[s]);
  const schema = z.object(Object.fromEntries(wanted.map((s) => [s, SECTION_SCHEMAS[s]])));

  const images = (await Promise.all((job.images || []).slice(0, 6).map(imagePart))).filter(Boolean);

  const prompt = [
    describeJob(job),
    "",
    describeSearchData(searchData),
    "",
    `Website service pages (for internal links): ${options.serviceGroups.map((g) => `${g.division}: ${g.services.slice(0, 12).join(", ")}`).join(" / ")}`,
    current && wanted.length < SECTIONS.length
      ? `\nThe other parts already written (keep consistent with them):\n${JSON.stringify(current, null, 1).slice(0, 4000)}`
      : "",
    instructions ? `\nExtra instructions from the user for this version: ${instructions}` : "",
    `\nWrite: ${wanted.join(", ")}.`,
  ].join("\n");

  const modelId = model || (await getActiveModel());
  const { output, usage, providerMetadata } = await generateText({
    model: modelId,
    system: VOICE,
    maxOutputTokens: 8000,
    output: Output.object({ schema }),
    messages: [
      {
        role: "user",
        content: [...images, { type: "text", text: prompt }],
      },
    ],
  });

  const run = {
    model: modelId,
    sections: wanted,
    full: wanted.length === SECTIONS.length,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    costUsd: await runCost(modelId, usage, providerMetadata),
    at: new Date().toISOString(),
  };
  return { content: cleanContent(output), run };
}

/** Keep values the website will accept; tidy hashtags. */
export function cleanContent(content) {
  const out = { ...content };
  const tag = (t) => {
    const s = String(t).trim().replace(/\s+/g, "");
    return s ? (s.startsWith("#") ? s : `#${s}`) : null;
  };
  if (out.linkedin) out.linkedin = { ...out.linkedin, hashtags: [...new Set(out.linkedin.hashtags.map(tag).filter(Boolean))].slice(0, 5) };
  if (out.instagram) out.instagram = { ...out.instagram, hashtags: [...new Set(out.instagram.hashtags.map(tag).filter(Boolean))].slice(0, 30) };
  if (out.caseStudy) {
    const cs = normaliseCaseStudy({ ...out.caseStudy, services: asList(out.caseStudy.services).filter((s) => ALL_SERVICES.includes(s)) });
    if (cs.durationWeeks == null) delete cs.durationWeeks;
    if (!cs.seoServiceLinks) cs.seoServiceLinks = serviceLinksFor(cs.services);
    cs.testimonialEnabled = Boolean(cs.testimonialQuote);
    out.caseStudy = cs;
  }
  return out;
}

/* --- Growth insights ------------------------------------------------------ */

const insightsSchema = z.object({
  summary: z.string().describe("3-5 sentence plain-English read of how social and search are performing and what's driving it"),
  recommendations: z.array(recommendationSchema).describe("6-10 prioritised actions for the next 30 days"),
  contentIdeas: z.array(
    z.object({
      idea: z.string().describe("A post or case study idea"),
      why: z.string().describe("Why it should perform, tied to the data"),
      channel: z.enum(["linkedin", "instagram", "website", "google-business"]),
    })
  ).describe("4-6 content ideas"),
});

/**
 * Advice from the real numbers: Buffer post metrics, website traffic and
 * Search Console queries. `data.simulated` marks sandbox numbers.
 */
export async function generateInsights(data) {
  const { output } = await generateText({
    model: await getActiveModel(),
    system: `${VOICE}

You are also a pragmatic B2B growth advisor for a contractor. Recommendations must be specific and doable by a small marketing team. Base every claim on the data provided; if data is missing or simulated, say so and give best-practice guidance instead.`,
    maxOutputTokens: 5000,
    output: Output.object({ schema: insightsSchema }),
    prompt: `Data for the last ${data.days} days (JSON):\n${JSON.stringify(data, null, 1).slice(0, 30000)}`,
  });
  return output;
}

/* --- Content planner ------------------------------------------------------ */

const plannedIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().describe("Working title, specific: a real job type, building type or question — not a slogan"),
        angle: z.string().describe("1-2 sentences: what the piece shows or answers, and which photos or job details it needs"),
        keyword: z.string().describe("The exact search phrase it targets, copied from the data provided; empty string if none fits"),
        format: z.enum(["case-study", "service-page", "article", "linkedin", "google-business"]),
        why: z.string().describe("One sentence tying it to the data: volume, gap, rising trend, quick win or AI question"),
      })
    )
    .describe("8-12 ideas, strongest first"),
});

/**
 * Plan content from stored market data (keyword demand, competitor gaps,
 * questions AI assistants get, Search Console quick wins, review topics).
 * Returns { ideas, run }.
 */
export async function generateContentIdeas(context) {
  const modelId = await getActiveModel();
  const { output, usage, providerMetadata } = await generateText({
    model: modelId,
    system: `${VOICE}

You are planning content for a building services contractor (air conditioning, mechanical, electrical, facilities management) in London, Kent and the South East. Their content is mostly case studies of real jobs with photos, plus service pages and short posts. Prefer ideas the team can make from jobs they actually do. Only use keywords that appear in the data; never invent search volumes. Skip anything already in the pipeline.`,
    maxOutputTokens: 5000,
    output: Output.object({ schema: plannedIdeasSchema }),
    prompt: `Data (JSON):\n${JSON.stringify(context, null, 1).slice(0, 40000)}`,
  });
  return {
    ideas: output.ideas,
    run: { model: modelId, costUsd: await runCost(modelId, usage, providerMetadata), at: new Date().toISOString() },
  };
}

/* --- Monthly report ------------------------------------------------------- */

const reportSummarySchema = z.object({
  headline: z.string().describe("One line, the month in a sentence, e.g. 'Search clicks up 18%; two case studies shipped; reviews flat'"),
  summary: z.string().describe("4-6 sentences for the directors: what moved, why, and what it means for enquiries"),
  wins: z.array(z.string()).describe("2-5 specific wins with numbers"),
  concerns: z.array(z.string()).describe("0-4 specific problems or risks with numbers; empty if none"),
  nextMonth: z.array(recommendationSchema).describe("4-6 prioritised actions for next month"),
});

/**
 * Executive summary for a month of report data. Only states what the data
 * shows; missing sources are said to be missing. Returns { summary, run }.
 */
export async function generateReportSummary(data) {
  const modelId = await getActiveModel();
  const { output, usage, providerMetadata } = await generateText({
    model: modelId,
    system: `${VOICE}

You write the monthly marketing report for the directors of a building services contractor. Use only numbers in the data; never invent figures. If a source is missing or simulated (sandbox), say so plainly. Compare with the previous period where the data gives one. Tie actions to enquiries.`,
    maxOutputTokens: 4000,
    output: Output.object({ schema: reportSummarySchema }),
    prompt: `Report data for ${data.range.label}${data.range.partial ? " (month to date)" : ""} (JSON):\n${JSON.stringify(data, null, 1).slice(0, 40000)}`,
  });
  return { summary: output, run: { model: modelId, costUsd: await runCost(modelId, usage, providerMetadata), at: new Date().toISOString() } };
}

/* --- Outreach ------------------------------------------------------------- */

const outreachSchema = z.object({
  subject: z.string().describe("Email subject, under 60 characters, specific to them — no clickbait, no 'Quick question'"),
  body: z
    .string()
    .describe(
      "Plain-text email, 70-130 words. Open with something specific to their business or area, not flattery. One relevant piece of our work if a matching job is given (named only as given). One low-friction ask (a site survey or a 15-minute call). Sign off as {{sender_name}}, Acme Ltd. No attachments mentioned, no links except {{case_study_url}} if a job is cited."
    ),
});

/**
 * Personalised outreach for a lead. `jobs` are our real jobs (title,
 * sector, services) to cite; `kind` is "intro" or "follow-up". The draft
 * still has to be approved before it can be sent. Returns { draft, run }.
 */
export async function generateOutreach(lead, { jobs = [], kind = "intro", instructions, previous } = {}) {
  const modelId = await getActiveModel();
  const facts = {
    business: { name: lead.name, category: lead.category, area: lead.city || lead.address, website: lead.website, googleRating: lead.rating, googleReviews: lead.reviews },
    contact: lead.contact?.name ? { name: lead.contact.name, role: lead.contact.role } : "unknown — address them by business, not 'Sir/Madam'",
    ourRelevantJobs: jobs.slice(0, 5),
    notes: lead.notes || undefined,
    previousEmail: previous ? { subject: previous.subject, body: previous.body, sentAt: previous.sentAt } : undefined,
  };
  const { output, usage, providerMetadata } = await generateText({
    model: modelId,
    system: `${VOICE}

You write short B2B outreach emails from Acme Ltd to businesses that may need air conditioning, mechanical, electrical or facilities management work. Cold email rules: about them first, one proof point, one small ask, no hard sell. Never claim work, clients, accreditations or results that aren't in the data. ${kind === "follow-up" ? "This is a polite follow-up to the previous email: shorter (40-80 words), adds one new useful point, no guilt-tripping." : ""}`,
    maxOutputTokens: 1500,
    output: Output.object({ schema: outreachSchema }),
    prompt: `${instructions ? `Extra instructions: ${instructions}\n\n` : ""}Data (JSON):\n${JSON.stringify(facts, null, 1)}`,
  });
  return { draft: output, run: { model: modelId, costUsd: await runCost(modelId, usage, providerMetadata) } };
}

/* --- Word case study → website fields -------------------------------------- */

const extractionSchema = z.object({
  caseStudy: caseStudySchema,
  fromDocument: z.array(z.string()).describe("Field names whose content came from the document's own words or facts"),
  written: z.array(z.string()).describe("Field names you wrote or classified from the document (e.g. SEO fields, summary, services ticked)"),
  notInDocument: z.array(z.string()).describe("Field names the document doesn't support, left empty — e.g. postcode, durationWeeks, testimonialQuote"),
  checks: z.array(z.string()).describe("Up to 5 short things a person should confirm before publishing (ambiguous dates, unclear client name, services you were unsure about)"),
});

/**
 * Read a Word case study (as plain text with headings) into the website's
 * fields. The AI reorganises the document into the website's sections and
 * classifies it against the website's fixed lists; it never adds facts the
 * document doesn't contain. `known` values win. Returns { result, run }.
 */
export async function extractCaseStudyFromDocument({ text, known = {}, model }) {
  const modelId = model || (await getActiveModel());
  const knownLines = Object.entries(known)
    .filter(([, v]) => (Array.isArray(v) ? v.length : v))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");
  const { output, usage, providerMetadata } = await generateText({
    model: modelId,
    system: `${VOICE}

You turn a case study written in Word into the fields of the Acme Ltd website's case study editor. The document may use any headings, order or wording — work out where each piece belongs:
- Scope of works = what the job involved; Key works delivered = the main works carried out; Key challenges & solutions; Project delivery highlights (programme, access, live-building working, H&S, handover documents); Project outcome & results.
- Keep the document's facts and good phrasing; tidy it into short markdown paragraphs and bullets. Don't pad. Don't drop technical detail (kit, makes, models, capacities, certificates).
- Classify company, sector, project type and services only from the fixed lists given. Tick every service genuinely delivered.
- Area, county, postcode, client, duration and testimonial: only what the document states. Leave empty otherwise.
- Write the summary and SEO fields from the document's content.
- Values under "Already known" are correct — use them as given.`,
    maxOutputTokens: 8000,
    output: Output.object({ schema: extractionSchema }),
    prompt: `${knownLines ? `Already known (use as given):\n${knownLines}\n\n` : ""}Website service pages (for choosing services): ${options.serviceGroups.map((g) => `${g.division}: ${g.services.join(", ")}`).join(" / ")}

The document:
"""
${String(text).slice(0, 60000)}
"""`,
  });
  const caseStudy = cleanContent({ caseStudy: output.caseStudy }).caseStudy;
  return {
    result: { ...output, caseStudy },
    run: { model: modelId, inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null, costUsd: await runCost(modelId, usage, providerMetadata) },
  };
}

/* --- Growth check brief ---------------------------------------------------- */

const focusBriefSchema = z.object({
  headline: z.string().describe("One line: the single most important thing this week, specific, with a number if the findings give one"),
  summary: z.string().describe("3-5 sentences for the boss: where things stand, what's working, what's slipping, and why it matters for enquiries"),
  focus: z
    .array(z.object({ title: z.string().describe("A focus area, imperative, under 60 characters"), why: z.string().describe("One or two sentences tying it to the findings") }))
    .describe("Exactly 3 focus areas, most important first"),
  checklist: z
    .array(
      z.object({
        key: z.string().describe("The `key` of the finding this item comes from — copied exactly"),
        title: z.string().describe("Imperative task, specific, under 80 characters"),
        why: z.string().describe("One sentence: why it matters"),
        impact: z.enum(["high", "medium", "low"]),
        effort: z.enum(["minutes", "hour", "half-day", "day+"]).describe("Rough effort for a small marketing team"),
      })
    )
    .describe("6-12 tasks drawn only from the findings, ordered by impact then effort (quick high-impact first)"),
});

/**
 * Turn the growth check's findings into one brief and a checklist. Items
 * must come from the findings (by key) — nothing invented. Returns
 * { brief, run }.
 */
export async function generateFocusBrief({ findings, checks }) {
  const modelId = await getActiveModel();
  const { output, usage, providerMetadata } = await generateText({
    model: modelId,
    system: `${VOICE}

You are the growth lead for this contractor's marketing. You get the results of an automated check across their content, posting, search, competitors, reputation and leads. Decide what matters most this week. Prefer actions that lead to enquiries. Merge duplicates. Use only the findings given — no new facts or numbers.`,
    maxOutputTokens: 4000,
    output: Output.object({ schema: focusBriefSchema }),
    prompt: `Check results (JSON):\n${JSON.stringify({ checks, findings }, null, 1).slice(0, 40000)}`,
  });
  return { brief: output, run: { model: modelId, costUsd: await runCost(modelId, usage, providerMetadata), at: new Date().toISOString() } };
}
