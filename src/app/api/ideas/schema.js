import { z } from "zod";

import { FORMATS, SOURCES, STAGE_IDS } from "@/lib/ideas";

export const ideaSchema = z.object({
  title: z.string().trim().min(3).max(200),
  angle: z.string().max(2000).optional(),
  keyword: z.string().max(120).nullable().optional(),
  volume: z.number().int().min(0).nullable().optional(),
  score: z.number().min(0).max(100).nullable().optional(),
  format: z.enum(Object.keys(FORMATS)).optional(),
  source: z.enum(Object.keys(SOURCES)).optional(),
  sourceDetail: z.string().max(500).nullable().optional(),
  status: z.enum(STAGE_IDS).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(5000).optional(),
});

export const ideaPatchSchema = ideaSchema.partial().extend({ order: z.number().optional() });
