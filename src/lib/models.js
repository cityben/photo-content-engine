/**
 * Which AI model writes the content, and what it costs.
 *
 * Prices come live from the Vercel AI Gateway (gateway.getAvailableModels),
 * so they're always current. The shortlist and its scores are OUR estimates
 * for this job — B2B construction copy that has to rank — not a benchmark;
 * the app records the real cost of every run and lets you rewrite a job with
 * any model to compare.
 */

import { gateway } from "ai";

import { cached } from "@/lib/cache";
import { collection } from "@/lib/store";

export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

/**
 * Shortlist: all accept photos (needed to read job images) and structured
 * output. score = writing quality for SEO-minded B2B copy, out of 10.
 */
export const SHORTLIST = [
  {
    id: "anthropic/claude-haiku-5.5",
    tier: "Budget",
    score: 7,
    why: "Fast and cheap, follows the brief and house style well. Good for routine jobs; less nuance in the case-study story.",
  },
  {
    id: "google/gemini-3.8-flash",
    tier: "Budget",
    score: 7,
    why: "Very low cost with strong photo understanding. Copy can read more generic — expect to edit the LinkedIn hook.",
  },
  {
    id: "openai/gpt-5.4-mini",
    tier: "Budget",
    score: 6,
    why: "Cheap and reliable at structured fields (SEO title, meta description). Weaker at a natural, specific voice.",
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    tier: "Best value",
    score: 9,
    why: "Specific, technical, natural prose; sticks to the facts given; strong keyword placement without stuffing. The default.",
  },
  {
    id: "openai/gpt-5.6-sol",
    tier: "Best value",
    score: 8,
    why: "Strong general writer at a mid price; good at repurposing one story across formats.",
  },
  {
    id: "anthropic/claude-fable-5.1",
    tier: "Premium",
    score: 10,
    why: "Highest-quality long-form prose. Worth it for flagship case studies; overkill for routine posts.",
  },
  {
    id: "anthropic/claude-opus-5.5",
    tier: "Premium",
    score: 9,
    why: "Best reasoning about keywords and Search Console data; slower and dearer than Sonnet for similar copy.",
  },
];

/** Typical tokens for one full job (6 photos + write-up in, all sections out). Replaced by real averages once jobs exist. */
const TYPICAL_JOB = { inputTokens: 12000, outputTokens: 4000 };

const settings = () => collection("settings");

export async function getActiveModel() {
  try {
    const [doc] = await settings().find({ key: "ai-model" });
    if (doc?.value) return doc.value;
  } catch (error) {
    console.error("[models] Couldn't read model setting:", error.message);
  }
  return process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
}

export async function setActiveModel(id, user) {
  const [doc] = await settings().find({ key: "ai-model" });
  const value = { key: "ai-model", value: id, updatedBy: user?.email || null };
  return doc ? settings().update(doc.id, value) : settings().insert(value);
}

/** Live gateway catalogue (language models), cached for 6 hours. Prices per 1M tokens in USD. */
export async function gatewayModels({ refresh = false } = {}) {
  const { value } = await cached(
    "gateway-models",
    6 * 3600000,
    async () => {
      const { models } = await gateway.getAvailableModels();
      return models
        .filter((m) => !m.modelType || m.modelType === "language")
        .map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description || "",
          inputPerM: m.pricing?.input != null ? Number(m.pricing.input) * 1e6 : null,
          outputPerM: m.pricing?.output != null ? Number(m.pricing.output) * 1e6 : null,
        }));
    },
    { refresh }
  );
  return value;
}

export function estimateCost(model, usage = TYPICAL_JOB) {
  if (!model || model.inputPerM == null || model.outputPerM == null) return null;
  return (usage.inputTokens * model.inputPerM + usage.outputTokens * model.outputPerM) / 1e6;
}

/** Average real token use per full generation, from saved jobs. */
export async function averageJobUsage() {
  const jobs = await collection("jobs").find({});
  const runs = jobs.flatMap((j) => j.aiRuns || []).filter((r) => r.full && r.inputTokens && r.outputTokens);
  if (runs.length < 2) return { ...TYPICAL_JOB, measured: false, runs: runs.length };
  const avg = (k) => Math.round(runs.reduce((s, r) => s + r[k], 0) / runs.length);
  return { inputTokens: avg("inputTokens"), outputTokens: avg("outputTokens"), measured: true, runs: runs.length };
}

/** Everything the Settings page needs. Works (without prices) if the gateway can't be reached. */
export async function modelCatalog() {
  const [active, usage] = await Promise.all([getActiveModel(), averageJobUsage()]);
  let live = [];
  let error = null;
  try {
    live = await gatewayModels();
  } catch (e) {
    error = e.message;
  }
  const byId = new Map(live.map((m) => [m.id, m]));
  const shortlist = SHORTLIST.map((s) => {
    const m = byId.get(s.id);
    return {
      ...s,
      name: m?.name || s.id.split("/")[1],
      available: live.length ? Boolean(m) : null,
      inputPerM: m?.inputPerM ?? null,
      outputPerM: m?.outputPerM ?? null,
      perJob: estimateCost(m, usage),
    };
  });
  // Value = quality per pound: highest score per cost among those with prices.
  const priced = shortlist.filter((s) => s.perJob);
  const bestValue = priced.length
    ? priced.reduce((best, s) => (s.score / s.perJob > best.score / best.perJob ? s : best)).id
    : null;
  return {
    active,
    activeModel: byId.get(active) || null,
    shortlist,
    bestValue,
    others: live.filter((m) => !SHORTLIST.some((s) => s.id === m.id)),
    usage,
    error,
  };
}

/** Gateway credit balance (USD), or null if unavailable. */
export async function gatewayCredits() {
  try {
    return await gateway.getCredits();
  } catch {
    return null;
  }
}

/** Cost of one run: the gateway's own figure when it reports one, else tokens × live price. */
export async function runCost(modelId, usage, providerMetadata) {
  const reported = Number(providerMetadata?.gateway?.cost);
  if (Number.isFinite(reported) && reported > 0) return reported;
  try {
    const model = (await gatewayModels()).find((m) => m.id === modelId);
    return estimateCost(model, { inputTokens: usage?.inputTokens || 0, outputTokens: usage?.outputTokens || 0 });
  } catch {
    return null;
  }
}

export function isValidModelId(id) {
  return typeof id === "string" && /^[a-z0-9-]+\/[a-z0-9.:_-]+$/i.test(id) && id.length <= 100;
}
