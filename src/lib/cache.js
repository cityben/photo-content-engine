import { collection } from "@/lib/store";

/** Cache an expensive result (e.g. a website report) in the store for `ttlMs`. */
export async function cached(key, ttlMs, compute, { refresh = false } = {}) {
  const store = collection("cache");
  const [hit] = await store.find({ key });
  if (!refresh && hit && Date.now() - new Date(hit.updatedAt).getTime() < ttlMs) {
    return { value: hit.value, cachedAt: hit.updatedAt };
  }
  const value = await compute();
  const saved = hit ? await store.update(hit.id, { value }) : await store.insert({ key, value });
  return { value, cachedAt: saved.updatedAt };
}
