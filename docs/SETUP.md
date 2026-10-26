# Setup Guide — Photo Content Engine

Everything is optional except sign-in: without keys the app runs in **sandbox mode** with temporary storage, so you can click through every screen first and connect services one at a time. The **Settings** page in the app shows what's connected and checks each connection live.

| Service | Variables | What you get |
|---|---|---|
| Sign-in | `AUTH_SECRET`, `AUTH_USERS` | Required |
| AI Gateway | `AI_GATEWAY_API_KEY` (local only) | AI writing and insights |
| MongoDB | `MONGODB_URI` | Jobs saved permanently (required on Vercel) |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | Public photo links for Buffer/Instagram |
| Buffer | `BUFFER_API_KEY`, `ENABLE_BUFFER_POSTING` | Real scheduling, calendar and stats |
| Website | Set in **Settings → Website** (or `WEBSITE_API_KEY`) | Case study drafts, Search Console keywords, traffic |
| DataForSEO | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Competitors, keyword demand, trends, reviews, mentions, AI visibility, backlinks, page checks |

## Local development

Needs Node.js 20+.

```bash
git clone https://github.com/cityben/photo-content-engine.git
cd photo-content-engine
npm install
cp .env.example .env.local
npm run dev
```

## Sign-in

Generate a secret that encrypts session cookies and add it as `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Add a person

There's no sign-up page. Run this on your own machine (in the project folder) or in a GitHub Codespace — never paste a password anywhere it could be logged:

```bash
npm run hash-password -- ben@example.co.uk
```

It asks for the password twice (hidden, at least 12 characters) and prints a line like `ben@example.co.uk|scrypt.15.8.1.ikXZaRn...`. Put it in `AUTH_USERS`; separate several people with commas. To change a password run it again and replace that entry; to remove someone delete theirs. Redeploy after changing it.

5 wrong passwords for an email or IP within 15 minutes pauses sign-in for 15 minutes. Sessions last 12 hours.

### Microsoft 365 (optional)

Adds "Continue with Microsoft 365" under the password form.

1. [entra.microsoft.com](https://entra.microsoft.com) → **App registrations → New registration**, single tenant.
2. Redirect URI (Web): `https://YOUR-DOMAIN/api/auth/callback/microsoft-entra-id` (and `http://localhost:3000/...` for local).
3. Copy the **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`; put the **Directory (tenant) ID** into `AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0`.
4. **Certificates & secrets → New client secret** → `AUTH_MICROSOFT_ENTRA_ID_SECRET`.

Only accounts from your tenant with an email on `AUTH_ALLOWED_DOMAINS` (default `example.co.uk`) or `AUTH_ALLOWED_EMAILS` get in.

## AI (Vercel AI Gateway)

All AI goes through the gateway — no Anthropic key. On Vercel nothing is needed: the project's OIDC token signs in automatically. Locally, create a key in Vercel → **AI Gateway → API Keys** and set `AI_GATEWAY_API_KEY` (or run `vercel env pull`). Choose the model in the app under **Settings → AI model** (scores, live prices, cost per job). `AI_GATEWAY_MODEL` only sets the starting default.

## Storage

**MongoDB** keeps jobs, the post ↔ job links, sandbox posts and cached reports. In Vercel → **Storage → Browse Marketplace → MongoDB Atlas** (free tier is fine); it adds `MONGODB_URI` to the project. Or use an existing Atlas cluster with a separate database (`MONGODB_DB_NAME`, default `photo-engine`). Without it, data lives in memory and disappears on restart — fine locally, not on Vercel.

**Vercel Blob** gives photos public URLs that Buffer, Instagram and the website can fetch. Vercel → **Storage → Create → Blob**, connect it to the project (adds `BLOB_READ_WRITE_TOKEN`). Without it, photos are private to the app: drafting and the sandbox work, real posting doesn't. Re-upload photos on a job after connecting Blob.

## Buffer

1. In Buffer, connect your **LinkedIn page** and **Instagram business/creator account**.
2. Buffer → **Settings → API** → create a key → `BUFFER_API_KEY`. (The old v1 "access token" and `BUFFER_PROFILE_IDS` are no longer used — Buffer retires that API on 1 February 2027.)
3. Redeploy. The calendar and analytics now show real Buffer data, read-only.
4. When you're ready to schedule for real: `ENABLE_BUFFER_POSTING=true`.

**Testing safely:** pause the channel's queue in Buffer (channel → Settings → Pause queue). Scheduled posts stay put, can be edited and deleted from here, and never publish. Or set `SOCIAL_MODE=sandbox` to use the fake channels even with a key.

Instagram needs at least one photo per post (several become a carousel). Links go in the first comment, not the post body — it reaches more people on both networks.

## Website (case studies, keywords, traffic)

1. Sign in to the website admin as a developer → **/admin/api-keys** → create a key:
   - role **editor**
   - scopes `content:write`, `media:write`, `analytics:read`
   - leave allowed origins empty (this app calls from its server)
2. In this app, **Settings → Website**: enter the website address and paste the `cc_live_…` key, then **Test connection** and **Save**.
   - Until launch day the new site (with the API) runs at `https://staging.example.co.uk`; `www.example.co.uk` is still the old site and answers 404. Change the address on launch day — no redeploy needed.
   - The key is stored encrypted (AES-256-GCM, keyed from `AUTH_SECRET`) and never shown again. If you change `AUTH_SECRET`, paste the key again.
   - `WEBSITE_API_KEY` / `NEXT_PUBLIC_WEBSITE_URL` env vars still work as a fallback; anything saved in Settings wins. `WEBSITE_API_SECRET` isn't used and can be deleted.

Then on a job's **Case study** tab, **Send as draft** uploads the photos to the website and creates the case study unpublished. Review and publish it in the website admin. The **Search & keywords** and **Analytics** pages switch to real Search Console and GA4 numbers, and new jobs' keyword advice uses them.

## DataForSEO (market and reputation data)

1. Sign up at [dataforseo.com](https://dataforseo.com) and add credit (pay as you go; $50 lasts a long time at this scale).
2. Dashboard → **API Access**: copy the API login and API password (not your account password) into `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD`.
3. Optional: `DATAFORSEO_SANDBOX=true` to try every screen with free dummy data first.
4. `DATAFORSEO_MONTHLY_BUDGET` (USD, default 20) — refreshes stop once this month's spend reaches it. Settings shows spend and account balance.

Nothing is fetched automatically. Each **Refresh** button costs a few cents (AI answers ≈ $0.10 per domain, the rest ≈ $0.01–0.05) and stores a snapshot; pages read the latest snapshot for free, and repeated snapshots build history (e.g. competitor traffic over time). Reviews are queued by DataForSEO and arrive 1–5 minutes later — the page checks for you.

What each page uses:

- **Search & market → Competitors**: Labs competitors_domain, domain_rank_overview, serp_competitors, domain_intersection (keyword gap), ranked_keywords.
- **Search & market → Keyword ideas / Trends**: Labs keyword_ideas (with your seed keywords) and Google Trends explore (UK, 5 years).
- **Reputation & authority**: Business Data (Google Business profile, Google and Trustpilot reviews), Content Analysis (brand mentions and tone), AI Optimization LLM mentions (Google AI Overviews UK; ChatGPT data is US-only), Backlinks summary and domain intersection (link prospects), OnPage instant pages (page checks).
- **Leads → Find leads**: Business Data business_listings search (Google Maps listings by category within a radius), about $0.03 per search of up to 100 businesses.

## Other systems (API keys)

To let another project create jobs through `POST /api/v1/jobs`:

```bash
npm run new-api-key -- atlas
```

Put the printed `atlas:pce_…` line in `INTEGRATION_API_KEYS` (comma-separate several), redeploy, and give the other project the part after the colon. It sends `Authorization: Bearer pce_…`. Remove the entry to revoke it. Request and response formats: [API.md](API.md#for-other-systems-apiv1).

## Put it on a domain (Vercel)

1. vercel.com → **Add New → Project** → import `cityben/photo-content-engine` (production branch `main`).
2. Add the environment variables above (at least `AUTH_SECRET`, `AUTH_USERS`, and MongoDB via Storage), then **Deploy**. You get a `*.vercel.app` address straight away.
3. Own domain: **Settings → Domains → Add** e.g. `content.example.co.uk`, add the CNAME Vercel shows at your DNS provider. HTTPS is automatic.
4. If you use Microsoft sign-in, add the live callback URL to the app registration.

## Troubleshooting

| Message | Fix |
|---|---|
| "Unauthenticated. Configure AI_GATEWAY_API_KEY" | Local: set `AI_GATEWAY_API_KEY`. On Vercel: check AI Gateway is enabled for the team and has credit |
| "That email and password don't match" | Check the `AUTH_USERS` entry (no spaces, comma-separated) and redeploy. After 5 failures wait 15 minutes |
| "Posting to Buffer is switched off" | Set `ENABLE_BUFFER_POSTING=true` and redeploy |
| "Photos must be publicly hosted…" | Connect Vercel Blob, then re-upload the job's photos on its Photos & brief tab |
| "Buffer rejected the API key" | Recreate it in Buffer → Settings → API |
| Website "unauthorized" / "insufficient_role" | The key needs role editor and the scopes listed above |
| Jobs disappear after a while | `MONGODB_URI` isn't set — the app is using temporary memory |
