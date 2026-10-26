import { requireUser } from "@/lib/session";
import { getStoredImage } from "@/lib/media";

/** Photos kept in the app's own store (no Vercel Blob). Signed-in users only. */
export async function GET(_request, { params }) {
  const { response } = await requireUser();
  if (response) return response;
  const { id } = await params;
  const image = await getStoredImage(id);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
