# Photo Content Engine

Turn a finished job — photos and a few lines about it — into a LinkedIn post, an Instagram caption, a website case study, a Google Business post, keyword advice and next steps. Schedule the posts through Buffer, see them on a calendar, and track how they perform.

Internal tool for Acme Ltd. Next.js 16 (App Router), shadcn/ui, AI SDK via the Vercel AI Gateway.

## What it does

| Page | |
|---|---|
| **Dashboard** | Setup checklist, what's scheduled this week, 30-day numbers, AI "do next" advice, recent jobs |
| **Jobs → New job** | Upload up to 10 photos (resized in the browser) and a short write-up. AI reads the photos and writes everything |
| **Job** | Tabs for LinkedIn, Instagram, Case study, Google Business, Keywords, Tips, Photos & brief. Edit, rewrite a section with your own instructions, schedule posts (next queue slot or a set UK time), send the case study to the website as a draft |
| **Calendar** | Month/week view of every scheduled, published and failed post. Click to edit text, reschedule or delete. Agenda list on phones |
| **Analytics** | Impressions, reactions, engagement per channel, top posts (Buffer); website users, Google clicks, average position, enquiries and visits from social (website reports) |
| **Search & keywords** | Your real Google Search Console queries with position, change, CTR, a plain-English "why" and quick wins (positions 4–20 with impressions) |
| **Growth insights** | AI reads all of the above and gives a summary, a prioritised to-do list and content ideas |
| **Settings** | Live connection checks for Buffer, the website, AI, storage and sign-in, with the exact variable to set |

### Where the data comes from

- **AI** — every call goes through the Vercel AI Gateway (default `anthropic/claude-sonnet-5.5`). Output is typed (zod schemas), so case-study fields use the website's exact sectors, services and divisions.
- **Buffer** — Buffer's GraphQL API (`api.buffer.com`). Create, edit, delete and list posts; per-post and aggregated metrics (Buffer marks metrics experimental and refreshes them daily).
- **Website** — the Acme Ltd website's v1 API: photo upload, case study drafts (`published: false`), and its own copy of Google Search Console, GA4 and Business Profile data.
- **Keywords** — real Search Console data when the website is connected. Without it, keyword suggestions are clearly marked "Estimate".

### Testing without real accounts

With no `BUFFER_API_KEY` the app runs in **sandbox mode**: fake "Acme Ltd (sandbox)" LinkedIn and Instagram channels that queue, schedule, edit and delete like Buffer, and nothing leaves the app. Posts whose time passes show as published, with **simulated** stats (labelled everywhere) so the analytics screens can be tried.

To test on real Buffer without publishing: connect test or real channels in Buffer, **pause their queue** in Buffer, then schedule from here. Posts sit in Buffer, editable and deletable, and never publish.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run hash-password -- you@example.co.uk   # paste the output into AUTH_USERS
openssl rand -base64 32                               # paste into AUTH_SECRET
npm run dev
```

Open http://localhost:3000 and sign in. Add `AI_GATEWAY_API_KEY` to have the AI write content locally. Everything else is optional; see [docs/SETUP.md](docs/SETUP.md).

## Deploying

Vercel. Full steps, including storage, Buffer, the website key and a custom domain: [docs/SETUP.md](docs/SETUP.md).

## Security

- Every page and API route needs sign-in (`src/proxy.js`, plus a check in each API route). No public sign-up: accounts live in `AUTH_USERS` as salted scrypt hashes; 5 wrong passwords pause sign-in for 15 minutes. Optional Microsoft 365 sign-in is locked to your tenant.
- API keys stay on the server. The Settings page reports status, never values.
- Uploads are checked by their bytes, not their file name. Jobs can only reference photos this app stored, so the server can't be pointed at arbitrary URLs.
- Real posting needs `ENABLE_BUFFER_POSTING=true`; case studies are always created unpublished.
- Security headers on every response (frame denial, nosniff, HSTS, referrer and permissions policies).

## Project structure

```
src/
├── auth.js, proxy.js               Sign-in (Auth.js) and route protection
├── app/
│   ├── login/                      Sign-in page
│   ├── (app)/                      Signed-in pages: dashboard, jobs, calendar,
│   │                               analytics, keywords, insights, settings
│   └── api/                        jobs, uploads, media, posts, channels, insights, auth
├── components/                     App shell, uploader, post rows, ui/ (shadcn, paper style)
├── data/website-options.json       Website sectors, services, divisions (snapshot)
└── lib/
    ├── ai.js                       AI Gateway: job content + growth insights
    ├── jobs.js                     Job lifecycle: create, write, schedule, send to website
    ├── social/                     Buffer GraphQL client, sandbox, provider switch
    ├── website-api.js              Website v1 API: uploads, case studies, reports
    ├── growth.js                   Analytics + insights data
    ├── store/                      MongoDB, or in-memory for local dev
    ├── media.js                    Vercel Blob or local photo storage
    └── time.js                     UK-time scheduling helpers
tests/                              Jest: Buffer, website, sandbox, time, AI, auth, passwords
```

### Updating website options

`src/data/website-options.json` is a snapshot of the website's `lib/projectOptions.js` and `data/service-catalog.json`. When the website adds a service page or sector, refresh it so the AI and the case-study form offer the new value.

## Commands

| Command | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` / `npm run test:ci` | Tests (watch / once) |
| `npm run lint` | ESLint |
| `npm run hash-password -- <email>` | Create an `AUTH_USERS` entry |

## Roadmap

| Status | |
|---|---|
| ✅ | Photo + write-up → LinkedIn, Instagram, case study, Google Business, keywords, tips |
| ✅ | Buffer scheduling, calendar edit/delete, analytics, sandbox |
| ✅ | Website case study drafts, Search Console keywords, growth insights |
| Next | Drag-and-drop rescheduling on the calendar; Google Business posting through Buffer |
| Later | Leads finder and outreach (Phase 3) |

Private — Acme Ltd only.
