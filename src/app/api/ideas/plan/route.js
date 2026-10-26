import { route } from "@/lib/api";
import { planIdeas } from "@/lib/planner";

export const maxDuration = 120;

export const POST = route(async ({ user }) => planIdeas(user));
