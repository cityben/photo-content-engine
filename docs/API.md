# API — Photo Content Engine

These routes serve the web app. Every route requires a signed-in session (the `authjs.session-token` cookie); without one they return `401 { "error": "Sign in required" }`. Errors are always `{ "error": "message" }` with status 400 (bad input), 403 (posting disabled), 404, 429 (Buffer rate limit), 502 (Buffer/website error) or 500.

## Jobs

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/jobs` | | `{ jobs }` newest first |
| POST | `/api/jobs` | `{ title?, writeUp?, details?, images? }` | `{ job }` |
| GET | `/api/jobs/:id` | | `{ job }` |
| PATCH | `/api/jobs/:id` | any of `title, writeUp, details, images, content` (content sections merge) | `{ job }` |
| DELETE | `/api/jobs/:id` | | `{ ok }` — Buffer posts and website drafts are not touched |
| POST | `/api/jobs/:id/generate` | `{ sections?: ["linkedin","instagram","caseStudy","googleBusiness","seo","recommendations"], instructions? }` | `{ job }` with new `content` |
| POST | `/api/jobs/:id/schedule` | `{ channelId, text, dueAt? (ISO with offset; omit = next queue slot), firstComment?, imageUrls? }` | `{ post }` |
| POST | `/api/jobs/:id/website` | | `{ website: { projectId, slug, url, status: "draft" } }` |

`details`: `{ company, sector, projectType, services[], location, client, completedOn }`. `images`: `[{ url, width, height, alt, public }]` — URLs must come from `/api/uploads`.

## Photos

| Method | Path | |
|---|---|---|
| POST | `/api/uploads` | multipart `file` (JPEG/PNG/WebP, ≤4MB, checked by content), `width`, `height` → `{ image }` |
| GET | `/api/media/:id` | A photo stored without Vercel Blob (signed-in users only) |

## Posts (Buffer or sandbox)

| Method | Path | |
|---|---|---|
| GET | `/api/channels` | `{ mode: "live"|"sandbox", postingEnabled, channels }` (LinkedIn and Instagram only) |
| GET | `/api/posts?start=ISO&end=ISO` | `{ posts }` scheduled, sending, published, failed, drafts |
| GET | `/api/posts/:id` | `{ post }` with metrics |
| PATCH | `/api/posts/:id` | `{ text?, dueAt? }` — scheduled posts only |
| DELETE | `/api/posts/:id` | `{ ok }` |

Post shape: `{ id, channelId, service, channelName, text, status, dueAt, sentAt, externalLink, error, images[], metrics?, jobId?, jobTitle? }`.

## Insights

| Method | Path | |
|---|---|---|
| GET | `/api/insights` | Latest saved insights or `null` |
| POST | `/api/insights` | `{ days: 7–90 }` → new `{ summary, recommendations[], contentIdeas[] }` |
