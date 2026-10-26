/** What's connected, for the dashboard checklist and Settings. No secrets leave the server. */

import { aiModel } from "@/lib/ai";
import { blobConfigured } from "@/lib/media";
import { parseUsers } from "@/lib/passwords";
import { postingEnabled, socialMode } from "@/lib/social";
import { storageMode } from "@/lib/store";
import { websiteConfigured } from "@/lib/website-api";

export function setupStatus() {
  const onVercel = Boolean(process.env.VERCEL);
  return [
    {
      id: "ai",
      label: "AI writing (Vercel AI Gateway)",
      done: onVercel || Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
      detail: `Model: ${aiModel()}`,
      fix: "Set AI_GATEWAY_API_KEY locally. On Vercel it signs in automatically.",
    },
    {
      id: "storage",
      label: "Database (MongoDB)",
      done: storageMode() === "mongodb",
      detail: storageMode() === "mongodb" ? "Jobs are saved permanently." : "Using temporary memory — jobs vanish when the server restarts.",
      fix: "Set MONGODB_URI (MongoDB Atlas free tier works; Vercel → Storage → MongoDB Atlas adds it for you).",
    },
    {
      id: "photos",
      label: "Photo hosting (Vercel Blob)",
      done: blobConfigured(),
      detail: blobConfigured() ? "Photos get public links Buffer and Instagram can use." : "Photos are private to this app — fine for testing, but they can't be sent to real channels.",
      fix: "Vercel → Storage → Create → Blob, connect it to this project (adds BLOB_READ_WRITE_TOKEN).",
    },
    {
      id: "buffer",
      label: "Buffer",
      done: socialMode() === "live",
      detail:
        socialMode() === "sandbox"
          ? "Sandbox: fake LinkedIn and Instagram channels. Nothing is posted."
          : postingEnabled()
            ? "Live: scheduling goes to your real Buffer channels."
            : "Live, read only: calendar and stats show real data; scheduling is switched off.",
      fix: "Buffer → Settings → API → create a key, set BUFFER_API_KEY. Then ENABLE_BUFFER_POSTING=true to schedule.",
    },
    {
      id: "website",
      label: "Website (case studies + Search Console)",
      done: websiteConfigured(),
      detail: websiteConfigured()
        ? "Case studies go to the website as drafts; keyword data comes from Search Console."
        : "Not connected — keywords are AI estimates and case studies can't be sent.",
      fix: "Website → /admin/api-keys: create an editor key with content:write, media:write and analytics:read. Set WEBSITE_API_KEY.",
    },
    {
      id: "auth",
      label: "Sign-in",
      done: parseUsers().size > 0 && Boolean(process.env.AUTH_SECRET),
      detail: `${parseUsers().size} password account(s)${process.env.AUTH_MICROSOFT_ENTRA_ID_ID ? " + Microsoft 365" : ""}`,
      fix: "Set AUTH_SECRET and AUTH_USERS (npm run hash-password).",
    },
  ];
}
