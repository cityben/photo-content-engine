import { notFound, route } from "@/lib/api";
import { markSent } from "@/lib/leads";

// The email itself is sent from the user's own mail client; this records it.
export const POST = route(async ({ params, user }) => {
  const lead = await markSent(params.id, params.draftId, user);
  if (!lead) throw notFound("Draft not found");
  return { lead };
});
