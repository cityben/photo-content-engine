import { route } from "@/lib/api";
import { sendCaseStudy } from "@/lib/jobs";

export const maxDuration = 60;

export const POST = route(async ({ params }) => ({ website: await sendCaseStudy(params.id) }));
