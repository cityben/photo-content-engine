import { readJson, route } from "@/lib/api";
import { estimateAutopilot, getAutopilot, listAutopilotRuns, rankIdeas, setAutopilot } from "@/lib/autopilot";
import { listIdeas } from "@/lib/ideas";

import { autopilotSchema } from "./schema";

export const GET = route(async () => {
  const config = await getAutopilot();
  const [estimate, runs, ideas] = await Promise.all([estimateAutopilot(config), listAutopilotRuns(), listIdeas()]);
  return { config, estimate, runs, next: rankIdeas(ideas).slice(0, config.perRun).map((i) => ({ id: i.id, title: i.title, keyword: i.keyword, score: i.score })) };
});

export const PUT = route(async ({ request, user }) => {
  const config = await setAutopilot(await readJson(request, autopilotSchema), user);
  return { config, estimate: await estimateAutopilot(config) };
});
