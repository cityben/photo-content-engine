/**
 * Job photos.
 *
 * With BLOB_READ_WRITE_TOKEN (create a Blob store in Vercel → Storage) photos
 * go to Vercel Blob and get public URLs — Buffer, Instagram and the website
 * need to fetch them. Without it, photos are kept in the app's store and
 * served only to signed-in users, which is fine for drafting and the sandbox
 * but can't be posted to real channels.
 */

import { collection } from "@/lib/store";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** The real type from the file's first bytes — the browser's claim isn't trusted. */
export function sniffImageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Photo URLs this app created: its own store, or Vercel Blob. Anything else is refused (no fetching arbitrary URLs). */
export function isOwnImageUrl(url) {
  if (typeof url !== "string") return false;
  if (/^\/api\/media\/[0-9a-f-]{36}$/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function saveImage({ bytes, width, height }) {
  const contentType = sniffImageType(bytes);
  if (!contentType || !ACCEPTED_TYPES.includes(contentType)) {
    throw new Error("Use a JPG, PNG or WebP image.");
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image is over 4MB after resizing.");
  }

  const dims = {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
  };

  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`jobs/photo.${EXTENSIONS[contentType]}`, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return { url: blob.url, public: true, ...dims };
  }

  const media = collection("media");
  const record = await media.insert({
    contentType,
    data: Buffer.from(bytes).toString("base64"),
    ...dims,
  });
  return { url: `/api/media/${record.id}`, public: false, ...dims };
}

export async function getStoredImage(id) {
  const record = await collection("media").get(id);
  if (!record) return null;
  return { contentType: record.contentType, bytes: Buffer.from(record.data, "base64") };
}

export async function deleteImage(url) {
  if (!url) return;
  if (url.startsWith("/api/media/")) {
    await collection("media").remove(url.split("/").pop());
  } else if (blobConfigured()) {
    const { del } = await import("@vercel/blob");
    await del(url).catch((error) => console.error("[media] Failed to delete blob:", error));
  }
}
