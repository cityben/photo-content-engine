import { route } from "@/lib/api";
import { listChannels, postingEnabled, socialMode } from "@/lib/social";

export const GET = route(async () => ({
  mode: socialMode(),
  postingEnabled: postingEnabled(),
  channels: await listChannels(),
}));
