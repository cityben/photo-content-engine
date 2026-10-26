import { route } from "@/lib/api";
import { readyToSchedule } from "@/lib/jobs";

export const GET = route(async () => ({ items: await readyToSchedule() }));
