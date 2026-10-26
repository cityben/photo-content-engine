import { route } from "@/lib/api";
import { targetsData } from "@/lib/targets";

export const GET = route(async () => ({ targets: await targetsData() }));
