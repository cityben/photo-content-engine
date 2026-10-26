import { z } from "zod";

import { AUTOPILOT_FORMATS } from "@/lib/autopilot";

export const autopilotSchema = z.object({
  enabled: z.boolean().optional(),
  perRun: z.number().int().min(1).max(6).optional(),
  formats: z.array(z.enum(Object.keys(AUTOPILOT_FORMATS))).min(1).optional(),
  plan: z.boolean().optional(),
  photos: z.boolean().optional(),
});
