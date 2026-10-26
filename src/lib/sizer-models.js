/**
 * Image models offered for AI extend (Vercel AI Gateway), with a rough price
 * per image so the button can say what a click costs.
 */
export const EXTEND_MODELS = [
  { id: "openai/gpt-image-2", label: "GPT Image 2", usd: 0.08, note: "Best at matching the photo" },
  { id: "openai/gpt-image-1-mini", label: "GPT Image 1 mini", usd: 0.02, note: "Cheaper, softer detail" },
  { id: "bfl/flux-pro-1.0-fill", label: "FLUX Fill Pro", usd: 0.05, note: "Built for filling edges" },
];
