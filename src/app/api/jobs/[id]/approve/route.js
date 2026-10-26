import { z } from "zod";

import { readJson, route } from "@/lib/api";
import { APPROVABLE, setApproval } from "@/lib/jobs";

const schema = z.object({ section: z.enum(APPROVABLE), approved: z.boolean() });

export const POST = route(async ({ request, params, user }) => {
  const { section, approved } = await readJson(request, schema);
  return { job: await setApproval(params.id, section, approved, user) };
});
