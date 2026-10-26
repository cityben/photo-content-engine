import { collection } from "@/lib/store";

/**
 * Cache an expensive result (e.g. a website report) in the store for `ttlMs`.
 * If the store itself is unavailable, the value is computed directly — a
 * cache problem should never break a page.
 */
export async function cached(key, ttlMs, compute, { refresh = false } = {}) {
  const store = collection("cache");
  let hit = null;
  try {
    [hit] = await store.find({ key });
  } catch (error) {
    console.error(`[cache] read failed for ${key}:`, error.message);
    return { value: await compute(), cachedAt: new Date().toISOString() };
  }
  if (!refresh && hit && Date.now() - new Date(hit.updatedAt).getTime() < ttlMs) {
    return { value: hit.value, cachedAt: hit.updatedAt };
  }
  const value = await compute();
  try {
    const saved = hit ? await store.update(hit.id, { value }) : await store.insert({ key, value });
    return { value, cachedAt: saved.updatedAt };
  } catch (error) {
    console.error(`[cache] write failed for ${key}:`, error.message);
    return { value, cachedAt: new Date().toISOString() };
  }
}
