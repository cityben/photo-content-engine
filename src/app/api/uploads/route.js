import { route } from "@/lib/api";
import { saveImage } from "@/lib/media";

/** One photo per request (already resized in the browser). multipart: file, width, height. */
export const POST = route(async ({ request }) => {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new Error("Send the photo as a 'file' field.");
  const image = await saveImage({
    bytes: new Uint8Array(await file.arrayBuffer()),
    width: Number(form.get("width")),
    height: Number(form.get("height")),
  });
  return { image: { ...image, alt: "" } };
});
