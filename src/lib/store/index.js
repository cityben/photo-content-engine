/**
 * Tiny document store used for jobs, sandbox posts and uploaded media.
 *
 * - MONGODB_URI set → MongoDB (required on Vercel; data must outlive a request).
 * - Otherwise → in-memory, for local development and tests. Data is lost when
 *   the server restarts, and the UI says so.
 *
 * Documents are plain objects with a string `id`.
 */

import { randomUUID } from "node:crypto";

const MEMORY_KEY = Symbol.for("photo-content-engine.memory-store");
const MONGO_KEY = Symbol.for("photo-content-engine.mongo-client");

export function storageMode() {
  return process.env.MONGODB_URI ? "mongodb" : "memory";
}

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    const actual = key.split(".").reduce((o, k) => o?.[k], doc);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if ("$in" in value) return value.$in.includes(actual);
      if ("$gte" in value || "$lte" in value) {
        return (
          (value.$gte === undefined || actual >= value.$gte) &&
          (value.$lte === undefined || actual <= value.$lte)
        );
      }
    }
    return actual === value;
  });
}

function sortDocs(docs, sort) {
  if (!sort) return docs;
  const [[field, dir]] = Object.entries(sort);
  return [...docs].sort((a, b) => {
    const x = a[field] ?? "";
    const y = b[field] ?? "";
    return (x < y ? -1 : x > y ? 1 : 0) * (dir < 0 ? -1 : 1);
  });
}

function memoryCollection(name) {
  globalThis[MEMORY_KEY] ??= new Map();
  const db = globalThis[MEMORY_KEY];
  if (!db.has(name)) db.set(name, new Map());
  const docs = db.get(name);
  const clone = (d) => (d ? structuredClone(d) : null);

  return {
    async insert(doc) {
      const now = new Date().toISOString();
      const record = { id: randomUUID(), createdAt: now, updatedAt: now, ...doc };
      docs.set(record.id, structuredClone(record));
      return clone(record);
    },
    async get(id) {
      return clone(docs.get(id));
    },
    async find(filter = {}, { sort, limit } = {}) {
      const found = sortDocs([...docs.values()].filter((d) => matches(d, filter)), sort);
      return (limit ? found.slice(0, limit) : found).map(clone);
    },
    async update(id, patch) {
      const current = docs.get(id);
      if (!current) return null;
      const next = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
      docs.set(id, structuredClone(next));
      return clone(next);
    },
    async remove(id) {
      return docs.delete(id);
    },
  };
}

async function mongoDb() {
  if (!globalThis[MONGO_KEY]) {
    const { MongoClient } = await import("mongodb");
    globalThis[MONGO_KEY] = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      appName: "photo-content-engine",
    }).connect();
  }
  try {
    const client = await globalThis[MONGO_KEY];
    return client.db(process.env.MONGODB_DB_NAME || "photo-engine");
  } catch (error) {
    // Don't cache a failed connection — the next request tries again.
    globalThis[MONGO_KEY] = null;
    console.error("[store] MongoDB connection failed:", error.message);
    throw new Error(`Can't reach the database (${error.message}). In MongoDB Atlas, check Network Access allows Vercel (0.0.0.0/0).`);
  }
}

/** Is the database reachable? For Settings. */
export async function checkStorage() {
  if (storageMode() !== "mongodb") return { ok: true, mode: "memory" };
  try {
    const db = await mongoDb();
    await db.command({ ping: 1 });
    return { ok: true, mode: "mongodb", database: db.databaseName };
  } catch (error) {
    return { ok: false, mode: "mongodb", error: error.message };
  }
}

function fromMongo(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function mongoCollection(name) {
  const col = async () => (await mongoDb()).collection(name);
  return {
    async insert(doc) {
      const now = new Date().toISOString();
      const id = randomUUID();
      const record = { createdAt: now, updatedAt: now, ...doc };
      delete record.id;
      await (await col()).insertOne({ _id: id, ...record });
      return { id, ...record };
    },
    async get(id) {
      return fromMongo(await (await col()).findOne({ _id: id }));
    },
    async find(filter = {}, { sort, limit } = {}) {
      let cursor = (await col()).find(filter);
      if (sort) cursor = cursor.sort(sort);
      if (limit) cursor = cursor.limit(limit);
      return (await cursor.toArray()).map(fromMongo);
    },
    async update(id, patch) {
      const { id: _ignored, ...fields } = patch;
      const result = await (await col()).findOneAndUpdate(
        { _id: id },
        { $set: { ...fields, updatedAt: new Date().toISOString() } },
        { returnDocument: "after" }
      );
      return fromMongo(result);
    },
    async remove(id) {
      const result = await (await col()).deleteOne({ _id: id });
      return result.deletedCount > 0;
    },
  };
}

export function collection(name) {
  return storageMode() === "mongodb" ? mongoCollection(name) : memoryCollection(name);
}
