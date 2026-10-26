# Photo Content Engine

Turn a finished job — photos and a few lines about it — into a LinkedIn post, an Instagram caption, a website case study, a Google Business post, keyword advice and next steps. Schedule the posts through Buffer, see them on a calendar, and track how they perform.

Internal tool for Acme Ltd. Next.js 16 (App Router), shadcn/ui, AI SDK via the Vercel AI Gateway.

## What it does

| Page | |
|---|---|
| **Dashboard** | Setup checklist, what's scheduled this week, 30-day numbers, AI "do next" advice, recent jobs |
| **Jobs → New job** | Upload up to 10 photos and a short write-up — or import a Word case study (sections, client, location and photos are read straight from the document, no AI). Then draft with AI, or create it without AI and write it yourself |
| **Job** | Tabs for LinkedIn, Instagram, Case study, Google Business, Keywords, Tips, Photos & brief. Write by hand or with AI, rewrite a section with your own instructions, fill the case study from Word, **approve** each part, then schedule posts (next queue slot or a set UK time) and send the case study to the website as a draft |
| **Content pipeline** | Ideas board: Ideas → Planned → In progress → Published. Add from any keyword gap, keyword idea or AI question with one click, by hand, or let **Suggest ideas** plan 8–12 from your stored search, competitor, Search Console and review data. **Start a job** from an idea and the AI writes towards its target search; sending the case study marks it Published |
| **Calendar** | Week, month and list views of every scheduled, published and failed post. Pick your publishing days and times per channel, drag approved posts from the "Ready to schedule" tray onto a slot, drag posts to reschedule (with Undo), or auto-fill the next free slots |
| **Analytics** | Impressions, reactions, engagement per channel, top posts (Buffer); website users, Google clicks, average position, enquiries and visits from social (website reports) |
| **Search & market** | *Your search*: real Search Console queries with position, change, CTR, a plain-English "why" and quick wins. *Competitors*: who Google sees as your competitors, niche leaders for your service keywords, traffic and visibility side by side over time, keyword gaps (what they rank for and you don't) and each competitor's best pages. *Keyword ideas*: UK demand around your services scored by volume, value, buying intent, difficulty and momentum. *Trends*: five-year Google Trends seasonality |
| **Reputation & authority** | Google Business profile vs local rivals, Google and Trustpilot reviews (unanswered low ratings flagged), brand mentions across the web with tone, whether Google AI Overviews and ChatGPT cite you vs competitors, backlink authority, link prospects (sites linking to two competitors but not you) and page checks for your key pages |
| **Leads** | Find businesses that buy M&E and FM work (property managers, commercial agents, main contractors, occupiers) from Google Maps around London and Kent towns, scored for fit. Track them New → Contacted → Replied → Meeting → Won/Lost with a call/notes log. AI writes a personalised intro or follow-up citing your real jobs; **a person approves it** before it can be copied, opened in email or marked sent, and marking it sent sets a follow-up five working days out. Nothing is emailed by this tool |
| **Growth insights** | AI reads all of the above and gives a summary, a prioritised to-do list and content ideas |
| **Monthly report** | One month on one page: website KPIs with change vs the previous period, top queries and landing pages, social, work shipped (jobs, case studies, pipeline), market and reputation snapshots, tool running costs. **Write summary** adds an AI directors' summary (headline, wins, concerns, next month's actions) from those numbers only. **Download PDF** (print layout) and **CSV** exports |
| **Settings** | AI model picker (scores, live prices, cost per job, gateway credit) and live connection checks for Buffer, the website, storage and sign-in |

### Where the data comes from

- **AI** — every call goes through the Vercel AI Gateway. Pick the model in **Settings → AI model**: a shortlist of image-capable models with a writing score, live prices per 1M tokens and an estimated cost per job, or any other gateway model. Each run records its model, tokens and cost; **Rewrite → Model** tries another model on one job, and **Restore previous** undoes it. Output is typed (zod schemas), so case-study fields use the website's exact sectors, services and divisions.
- **Buffer** — Buffer's GraphQL API (`api.buffer.com`). Create, edit, delete and list posts; per-post and aggregated metrics (Buffer marks metrics experimental and refreshes them daily).
- **Website** — the Acme Ltd website's v1 API: photo upload, case study drafts (`published: false`), and its own copy of Google Search Console, GA4 and Business Profile data.
- **Keywords** — real Search Console data when the website is connected. Without it, keyword suggestions are clearly marked "Estimate".
- **DataForSEO** — market, competitor and reputation data (Google UK). Pay per request: pages read stored snapshots for free and only a **Refresh** spends, capped by `DATAFORSEO_MONTHLY_BUDGET`. See [docs/SETUP.md](docs/SETUP.md#dataforseo-market-and-reputation-data).

### Approval, and manual as the backup

- Every part can be written by hand: **Create without AI** on a new job, **Write it myself** on an empty one, or **Fill from Word** on the case study. If the AI fails, the job is kept and opens ready to write manually.
- **Nothing reaches Buffer or the website until a person approves that exact section.** The server enforces it: scheduling uses the saved, approved text (never text sent from the browser), and any edit or AI rewrite clears that section's approval. Approvals record who and when.

### Other systems (API)

`POST /api/v1/jobs` lets another system (e.g. your other project) create a job with whatever it already knows — title, sector, client, location, division, services, completion date — plus an optional Word case study and photos. Known values win over the document. Jobs arrive as unapproved drafts; optionally the AI drafts the posts. See [docs/API.md](docs/API.md#for-other-systems-apiv1).

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
- Real posting needs `ENABLE_BUFFER_POSTING=true` **and** an approved section; case studies are always created unpublished.
- `/api/v1/*` uses API keys (`INTEGRATION_API_KEYS`, compared in constant time). URLs it's given are fetched only over https from public addresses, size-capped, with no redirects.
- Security headers on every response (frame denial, nosniff, HSTS, referrer and permissions policies).

## Project structure

```
src/
├── auth.js, proxy.js               Sign-in (Auth.js) and route protection
├── app/
│   ├── login/                      Sign-in page
│   ├── (app)/                      Signed-in pages: dashboard, jobs, calendar,
│   │                               analytics, keywords, reputation, insights, settings
│   └── api/                        jobs, uploads, media, posts, channels, insights, market, auth
├── components/                     App shell, uploader, post rows, ui/ (shadcn, paper style)
├── data/website-options.json       Website sectors, services, divisions (snapshot)
└── lib/
    ├── ai.js                       AI Gateway: job content + growth insights
    ├── models.js                   Model shortlist, live prices, chosen model, run cost
    ├── jobs.js                     Job lifecycle: create, write, approve, schedule, send to website
    ├── content.js                  Sections and approval rules (shared with the browser)
    ├── docx-map.js / docx-*.js     Word case study → fields (no AI), browser and server
    ├── integration.js              /api/v1 job creation for other systems
    ├── social/                     Buffer GraphQL client, sandbox, provider switch
    ├── website-api.js              Website v1 API: uploads, case studies, reports
    ├── seo/                        DataForSEO client (budget guard), market + reputation snapshots
    ├── schedule.js / autofill.js   Publishing days and times, calendar auto-fill
    ├── ideas.js / planner.js       Content pipeline and the AI planner
    ├── reports.js                  Monthly report data, CSV export
    ├── leads.js                    Lead search, pipeline, outreach drafts and approval
    ├── growth.js                   Analytics + insights data
    ├── store/                      MongoDB, or in-memory for local dev
    ├── media.js                    Vercel Blob or local photo storage
    └── time.js                     UK-time scheduling helpers
tests/                              Jest: Buffer, website, sandbox, time, AI, models, auth, passwords, market, ideas, reports, leads
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
| `npm run new-api-key -- <name>` | Create an `INTEGRATION_API_KEYS` entry for another system |

## Roadmap

| Status | |
|---|---|
| ✅ | Photo + write-up → LinkedIn, Instagram, case study, Google Business, keywords, tips |
| ✅ | Buffer scheduling, calendar edit/delete, analytics, sandbox |
| ✅ | Website case study drafts, Search Console keywords, growth insights |
| ✅ | Calendar publishing days, drag to schedule/reschedule, auto-fill |
| ✅ | Competitors, keyword gaps, ideas, trends, reviews, mentions, AI visibility, backlinks, page checks (DataForSEO) |
| ✅ | Content pipeline linked to jobs and search data |
| ✅ | Monthly report with AI summary, PDF and CSV |
| ✅ | Leads and outreach with approved drafts and follow-ups |
| Next | Google Business posting through Buffer; sending outreach from Microsoft 365 once Entra sign-in is on |

Private — Acme Ltd only.
