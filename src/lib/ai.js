/**
 * AI generation via the Vercel AI Gateway.
 *
 * Model strings like "anthropic/claude-sonnet-5.5" are routed through the
 * gateway by the AI SDK. Auth is AI_GATEWAY_API_KEY locally, or the project's
 * OIDC token automatically when deployed on Vercel.
 */

import { generateText } from "ai";
import { parseImageData } from "./image-analyzer";
import { generateContentPrompts } from "./content-generator";

export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

function getModel() {
  return process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
}

const ANALYSIS_PROMPT = `You are an expert facilities and M&E (Mechanical & Electrical) industry analyst.

Analyze this job site photo and extract:
1. Equipment visible (HVAC units, electrical panels, piping, etc.)
2. Type of work (installation, maintenance, repair, etc.)
3. Scope and scale of work
4. Building type/sector (Commercial, Industrial, Residential, Healthcare, etc.)
5. Technical details visible
6. Quality/professionalism of the work

Respond in JSON format:
{
  "equipment": ["...", "..."],
  "work_type": "...",
  "scope": "...",
  "sector": "...",
  "technical_details": "...",
  "quality_assessment": "..."
}`;

/**
 * Pull the first JSON value out of a model response, tolerating code fences
 * and surrounding prose. Returns null when nothing parses.
 */
export function extractJson(text) {
  if (!text) return null;
  const unfenced = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    // fall through to a looser match
  }
  const match = unfenced.match(/[[{][\s\S]*[\]}]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Convert parseImageData's output into an AI SDK image part.
 */
function toImagePart(imageData) {
  const { source } = parseImageData(imageData);
  if (source.type === "url") {
    return { type: "image", image: new URL(source.url) };
  }
  return { type: "image", image: source.data, mediaType: source.media_type };
}

export async function analyzeImage(imageData) {
  const { text } = await generateText({
    model: getModel(),
    maxOutputTokens: 1000,
    messages: [
      {
        role: "user",
        content: [toImagePart(imageData), { type: "text", text: ANALYSIS_PROMPT }],
      },
    ],
  });

  return extractJson(text) || { raw: text };
}

export async function generateAllContent(analysis, metadata) {
  const prompts = generateContentPrompts(analysis, metadata);

  const results = await Promise.all(
    Object.entries(prompts).map(async ([format, prompt]) => {
      try {
        const { text } = await generateText({
          model: getModel(),
          maxOutputTokens: 1500,
          prompt,
        });
        return [format, extractJson(text) || { text }];
      } catch (error) {
        console.error(`[ai] Error generating ${format}:`, error);
        return [format, { error: error.message }];
      }
    })
  );

  return Object.fromEntries(results);
}
