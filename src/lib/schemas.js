import { z } from "zod";

import { isOwnImageUrl } from "@/lib/media";

export const imageSchema = z.object({
  url: z.string().max(2000).refine(isOwnImageUrl, "Photos must be uploaded through this app"),
  public: z.boolean().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  alt: z.string().max(500).optional(),
});

export const detailsSchema = z.object({
  company: z.string().max(100).optional(),
  sector: z.string().max(100).optional(),
  projectType: z.string().max(100).optional(),
  services: z.array(z.string().max(120)).max(10).optional(),
  location: z.string().max(200).optional(),
  client: z.string().max(200).optional(),
  completedOn: z.string().max(40).optional(),
});

export const jobInputSchema = z.object({
  title: z.string().max(200).optional(),
  writeUp: z.string().max(50000).optional(),
  details: detailsSchema.optional(),
  images: z.array(imageSchema).max(20).optional(),
  mainImage: z.string().max(2000).refine(isOwnImageUrl, "Unknown photo").nullable().optional(),
});

export const contentPatchSchema = z.record(z.string(), z.any());

export const jobCreateSchema = jobInputSchema.extend({
  content: contentPatchSchema.optional(),
  source: z.enum(["manual", "word", "ai"]).optional(),
  ideaId: z.string().max(100).optional(),
});

// Text and first comment come from the saved, approved content, not the request.
export const scheduleSchema = z.object({
  channelId: z.string().min(1).max(200),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  imageUrls: z.array(z.string().max(2000).refine(isOwnImageUrl, "Unknown photo")).max(10).optional(),
});

export const postEditSchema = z.object({
  text: z.string().min(1).max(5000).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
});
