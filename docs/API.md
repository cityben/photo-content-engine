# API — Photo Content Engine

Two sets of routes: **`/api/v1/*` for other systems** (API key), and the routes the web app itself uses (signed-in session).

## For other systems (`/api/v1`)

Authenticate with a key from `INTEGRATION_API_KEYS` (create one with `npm run new-api-key -- <name>`):

```
Authorization: Bearer pce_…
```

Errors: `{ "error": { "code", "message", "details"? } }` — `401 unauthorized`, `422 validation_failed` (details per field), `400 bad_request` / `create_failed`, `404 not_found`.

### POST /api/v1/jobs

Creates a job as an **unapproved draft** — nothing is scheduled or sent until someone approves it in the app. Send whatever you know; everything is optional.

| Field | | |
|---|---|---|
| `externalId` | string | Your own id. Sending it again returns the existing job instead of a duplicate |
| `title` | string | Wins over the document's heading |
| `writeUp` | string | Your notes; defaults to the document's text |
| `details` | object | `company`, `sector`, `projectType`, `services[]`, `location` (or `area` + `county`), `client`, `completedOn` (`YYYY-MM`), `durationWeeks`. **Known values win over the document**; use the website's exact option names (unmatched values are returned as warnings) |
| `caseStudy` | object | Any case-study fields to set directly (`description`, `scopeOfWorks`, `keyWorks`, `keyChallenges`, `deliveryHighlights`, `projectOutcome`, `seoTitle`, `metaDescription`, `testimonialQuote`, …) — these win over everything |
| `documentUrl` | https URL | A Word `.docx` case study to read (no AI) |
| `photoUrls` | https URLs | Up to 10 photos |
| `generate` | boolean | `true` = AI drafts the posts and fills only the empty case-study fields. Default `false` |

URLs must be https on the public internet; redirects aren't followed; documents ≤ 50MB, photos ≤ 25MB (resized to 2048px).

**JSON:**

```bash
curl -X POST https://YOUR-APP/api/v1/jobs \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"externalId":"atlas-42","title":"VRF swap, 30 South Colonnade","details":{"client":"Canary Wharf Group","sector":"Commercial Office","completedOn":"2026-04"},"documentUrl":"https://…/case-study.docx"}'
```

**Multipart** (upload the files directly; Vercel caps a request at 4.5MB, so use URLs for big files):

```bash
curl -X POST https://YOUR-APP/api/v1/jobs -H "Authorization: Bearer $KEY" \
  -F 'data={"externalId":"atlas-42","details":{"sector":"Commercial Office"}}' \
  -F "document=@case-study.docx" -F "photos=@plant-room.jpg"
```

**Response** `201` (or `200` if `externalId` already existed):

```json
{
  "data": {
    "id": "39b4ecf6-…", "externalId": "atlas-42", "title": "VRF swap, 30 South Colonnade",
    "url": "https://YOUR-APP/jobs/39b4ecf6-…",
    "written": true, "needsApproval": ["caseStudy"], "approvals": {},
    "posts": [], "website": null, "createdAt": "…"
  },
  "created": true,
  "warnings": []
}
```

### GET /api/v1/jobs/:id · GET /api/v1/jobs?externalId=…

The same `data` object: what still needs approval, who approved what, scheduled posts and the website draft.

---

## Web app routes

These routes serve the web app. Every route requires a signed-in session (the `authjs.session-token` cookie); without one they return `401 { "error": "Sign in required" }`. Errors are always `{ "error": "message" }` with status 400 (bad input), 403 (posting disabled), 404, 429 (Buffer rate limit), 502 (Buffer/website error) or 500.

## Jobs

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/jobs` | | `{ jobs }` newest first |
| POST | `/api/jobs` | `{ title?, writeUp?, details?, images?, content?, source? }` | `{ job }` |
| GET | `/api/jobs/:id` | | `{ job }` |
| PATCH | `/api/jobs/:id` | any of `title, writeUp, details, images, content` (content sections merge; changed sections lose their approval) | `{ job }` |
| DELETE | `/api/jobs/:id` | | `{ ok }` — Buffer posts and website drafts are not touched |
| POST | `/api/jobs/:id/generate` | `{ sections?: ["linkedin","instagram","caseStudy","googleBusiness","seo","recommendations"], instructions?, model?, preserve?: ["caseStudy"] }` (rewritten sections lose their approval) | `{ job }` with new `content`; the run's model, tokens and cost are added to `aiRuns` |
| POST | `/api/jobs/:id/approve` | `{ section: "linkedin"|"instagram"|"caseStudy"|"googleBusiness", approved }` | `{ job }` |
| POST | `/api/jobs/:id/schedule` | `{ channelId, dueAt? (ISO with offset; omit = next queue slot), imageUrls? }` — the post's text and first comment are the saved, approved content | `{ post }`, or `403` if not approved |
| POST | `/api/jobs/:id/website` | | `{ website: { projectId, slug, url, status: "draft" } }`, or `403` if the case study isn't approved |

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

## AI model

| Method | Path | |
|---|---|---|
| GET | `/api/settings/model` | `{ catalog: { active, shortlist[], bestValue, others[], usage } }` — prices per 1M tokens from the gateway |
| PUT | `/api/settings/model` | `{ model }` — sets the model for new writes |

## Insights

| Method | Path | |
|---|---|---|
| GET | `/api/insights` | Latest saved insights or `null` |
| POST | `/api/insights` | `{ days: 7–90 }` → new `{ summary, recommendations[], contentIdeas[] }` |
