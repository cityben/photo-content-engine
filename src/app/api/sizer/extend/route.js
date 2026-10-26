import { generateImage } from "ai";
import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { EXTEND_MODELS } from "@/lib/sizer-models";

export const maxDuration = 120;

const b64 = (max) => z.string().max(max).regex(/^[A-Za-z0-9+/=]+$/, "Not base64");

/**
 * AI extend: the photo on a larger canvas plus a mask of the empty edges;
 * the image model paints the edges in. One call per shape.
 */
export const POST = route(async ({ request }) => {
  const input = await readJson(
    request,
    z.object({
      image: b64(3_500_000),
      mask: b64(1_000_000),
      size: z.enum(["1024x1024", "1536x1024", "1024x1536"]),
      model: z.enum(EXTEND_MODELS.map((m) => m.id)),
      prompt: z.string().max(500).optional(),
    })
  );
  const text = [
    "Extend this photograph outwards to fill the transparent areas of the mask.",
    "Continue the existing scene naturally: same building, surfaces, lighting, perspective and camera. Do not add people, text, logos or new objects.",
    input.prompt ? `Also: ${input.prompt}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const result = await generateImage({
    model: input.model,
    prompt: { images: [Buffer.from(input.image, "base64")], mask: Buffer.from(input.mask, "base64"), text },
    size: input.size,
  });
  return { image: result.image.base64, mediaType: result.image.mediaType || "image/png" };
});
