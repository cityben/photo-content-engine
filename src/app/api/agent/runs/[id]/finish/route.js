import { route } from "@/lib/api";
import { finishRun } from "@/lib/agent";

export const maxDuration = 120;

export const POST = route(async ({ params }) => ({ run: await finishRun(params.id) }));
