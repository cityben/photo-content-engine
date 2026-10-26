import { route } from "@/lib/api";
import { markGooglePosted } from "@/lib/jobs";

export const POST = route(async ({ params, user }) => ({ job: await markGooglePosted(params.id, user) }));
