import { route } from "@/lib/api";
import { runCheck } from "@/lib/agent";

// Paid refreshes (AI visibility especially) can take a while.
export const maxDuration = 300;

export const POST = route(async ({ params }) => ({ result: await runCheck(params.id, params.checkId) }));
