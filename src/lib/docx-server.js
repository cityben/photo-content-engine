/**
 * Read a .docx on the server (for the integration API). Same mapping as the
 * in-browser import: text blocks + embedded photos.
 */

import mammoth from "mammoth";
import { parse } from "node-html-parser";

import { elementsToBlocks } from "@/lib/docx-blocks";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function isDocx(bytes) {
  // .docx is a zip file: "PK\x03\x04"
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export async function readDocxBuffer(buffer) {
  if (!isDocx(buffer)) throw new Error("The document isn't a Word .docx file.");
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const root = parse(html);
  const blocks = elementsToBlocks(root.childNodes.filter((n) => n.nodeType === 1));

  const photos = [];
  for (const img of root.querySelectorAll("img")) {
    const match = (img.getAttribute("src") || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !PHOTO_TYPES.includes(match[1])) continue;
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length >= 15 * 1024) photos.push(bytes); // skip logos and icons
  }
  return { blocks, photos };
}
