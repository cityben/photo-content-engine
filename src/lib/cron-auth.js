import { timingSafeEqual } from "node:crypto";

/** Vercel Cron calls with "Authorization: Bearer $CRON_SECRET" (see vercel.json). */
export function cronAuthorised(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
