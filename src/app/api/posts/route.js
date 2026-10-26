import { route } from "@/lib/api";
import { listPosts } from "@/lib/social";

export const GET = route(async ({ request }) => {
  const url = new URL(request.url);
  const start = url.searchParams.get("start") || undefined;
  const end = url.searchParams.get("end") || undefined;
  return { posts: await listPosts({ start, end }) };
});
