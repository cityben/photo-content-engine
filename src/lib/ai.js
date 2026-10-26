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
  title: z.string().describe("Case study title, specific: what was done, where. Under 70 characters."),
  description: z.string().describe("1-2 sentence lede, under 300 characters. Also used as the meta description fallback."),
  company: z.enum(options.companies).describe("The division that delivered the work"),
  sector: z.enum(options.sectors),
  projectType: z.enum(options.projectTypes),
  services: z.array(z.string()).describe(`1-4 services delivered, copied EXACTLY from this list: ${ALL_SERVICES.join(" | ")}`),
  client: z.string().describe("Client or building name if stated in the write-up, else empty"),
  area: z.string().describe("Town or borough if known, e.g. 'Canary Wharf', else empty"),
  county: z.string().describe("County if known, e.g. 'London' or 'Kent', else empty"),
  scopeOfWorks: z.string().describe("Markdown. What was in scope. 2-5 bullet points or a short paragraph."),
  keyWorks: z.string().describe("Markdown bullets: the main works delivered."),
  keyChallenges: z.string().describe("Markdown: challenges and how they were solved. Only real ones from the write-up/photos; empty if none known."),
  deliveryHighlights: z.string().describe("Markdown: delivery highlights (programme, access, live-building working, H&S, handover documents). Empty if none known."),
  projectOutcome: z.string().describe("Markdown: the outcome for the client. No invented figures."),
  seoTitle: z.string().describe("SEO <title>, 50-60 characters, primary keyword near the start, ends with '| Acme Ltd' if it fits"),
  metaDescription: z.string().describe("140-155 characters, includes primary keyword and location, ends with a reason to click"),
  seoH1: z.string().describe("On-page H1, can differ slightly from the title"),
  primaryKeyword: z.string().describe("Single primary keyword phrase this page should rank for"),
  supportingKeywords: z.string().describe("Comma-separated supporting keywords (4-8)"),
  mainImageAlt: z.string().describe("Alt text for the hero photo"),
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
    out.caseStudy = { ...out.caseStudy, services: out.caseStudy.services.filter((s) => ALL_SERVICES.includes(s)) };
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
