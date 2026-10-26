import { route } from "@/lib/api";
import { isOwnImageUrl } from "@/lib/media";

// A canvas can only export photos from its own origin, so job photos hosted
// on Vercel Blob are passed through here. Only our own photo URLs.
export const GET = route(async ({ request }) => {
  const url = new URL(request.url).searchParams.get("url");
  if (!isOwnImageUrl(url) || url.startsWith("/")) throw new Error("Not one of this app's photos.");
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Couldn't load the photo (${res.status}).`);
  return new Response(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
});
