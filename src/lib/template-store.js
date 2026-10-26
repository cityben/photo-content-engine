/** Channel templates, kept in the database (Settings → Templates). See templates.js. */

import { collection } from "@/lib/store";
import { cleanTemplates } from "@/lib/templates";

const KEY = "templates";
// Shared between page and route module instances (see profile.js).
const cache = (globalThis.__templatesCache ||= { memo: null });

export async function getTemplates() {
  const { memo } = cache;
  if (memo && Date.now() - memo.at < 30000) return memo.value;
  let value = cleanTemplates();
  try {
    const [doc] = await collection("settings").find({ key: KEY });
    value = cleanTemplates(doc?.value);
  } catch (error) {
    console.error("[templates] read failed:", error.message);
  }
  cache.memo = { at: Date.now(), value };
  return value;
}

export async function saveTemplates(input, user) {
  const value = cleanTemplates(input);
  const settings = collection("settings");
  const [doc] = await settings.find({ key: KEY });
  const record = { key: KEY, value, updatedBy: user?.email || null };
  if (doc) await settings.update(doc.id, record);
  else await settings.insert(record);
  cache.memo = null;
  return value;
}
