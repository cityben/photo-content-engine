/**
 * Read a .docx in the browser (no upload, no size limit): text blocks for
 * docx-map.js and the embedded photos as Files ready to upload.
 */

import { elementsToBlocks } from "@/lib/docx-blocks";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_DOCX_BYTES = 50 * 1024 * 1024;

export async function readDocx(file) {
  if (!/\.docx$/i.test(file.name)) {
    throw new Error(/\.doc$/i.test(file.name) ? "That's an old .doc file. In Word, use File → Save As → Word Document (.docx), then import that." : "Choose a Word .docx file.");
  }
  if (file.size > MAX_DOCX_BYTES) throw new Error("That document is over 50MB.");

  const mod = await import("mammoth");
  const mammoth = mod.default || mod;
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const doc = new DOMParser().parseFromString(html, "text/html");

  const blocks = elementsToBlocks([...doc.body.children]);

  const photos = [];
  let skipped = 0;
  for (const [i, img] of [...doc.querySelectorAll("img")].entries()) {
    const src = img.getAttribute("src") || "";
    if (!src.startsWith("data:")) continue;
    const blob = await (await fetch(src)).blob();
    if (!PHOTO_TYPES.includes(blob.type)) {
      skipped++;
      continue;
    }
    // Skip logos and icons.
    if (blob.size < 15 * 1024) {
      skipped++;
      continue;
    }
    photos.push(new File([blob], `document-photo-${i + 1}.${blob.type.split("/")[1]}`, { type: blob.type }));
  }

  return { blocks, photos, skippedImages: skipped };
}
