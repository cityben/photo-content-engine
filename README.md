# Photo Content Engine

🎯 **AI-powered job photo → marketing content generator + lead finder for Acme Ltd**

Transform job site photos into professional marketing content across 7 platforms in seconds, plus identify qualified leads to win more work.

## Features

### Phase 1 (MVP) ✅
- 📸 **Upload job photos** (single or batch)
- 🎯 **Generate 7 content formats:**
  - LinkedIn post (professional hook + description)
  - Instagram caption (engaging + CTAs)
  - Before/after description (case studies)
  - Google My Business post (local SEO)
  - Blog post outline (title + sections + keywords)
  - Schema markup (structured data for Google)
  - Twitter thread (multi-tweet format)
- 🔍 **SEO keyword extraction** (find what people are searching for)
- 📋 **Export ready-to-post** or manual review before posting
- 🔗 **Buffer.com integration** (schedule posts)
- 🌐 **Website auto-post** (create draft case studies)

### Phase 2 (v1.1)
- 📊 **Content performance analytics** (which formats get most engagement)
- ⚙️ **Auto-posting to Buffer**
- 🎯 **Keyword difficulty analyzer** (focus on winnable keywords)
- 📈 **Engagement tracking** (LinkedIn, Instagram, website traffic)

### Phase 3 (v2.0)
- 👥 **Leads scraper** (find facilities managers, building owners)
- 📧 **Personalized outreach email generator**
- 🔥 **Warm lead tracking** (monitor who engages with your content)
- 📍 **Location-based targeting** (service areas only)

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/photo-content-engine.git
cd photo-content-engine
npm install
```

### 2. Set Environment Variables

```bash
cp .env.example .env.local
```

Then add your API keys:
- `AUTH_SECRET` plus Microsoft 365 or Google Workspace sign-in keys — see [Sign-in](docs/SETUP.md#sign-in)
- `AI_GATEWAY_API_KEY` — from vercel.com → AI Gateway → API Keys (not needed on Vercel deployments, which authenticate with OIDC)
- `BUFFER_API_TOKEN` — from buffer.com/developers
- `BUFFER_PROFILE_IDS` — comma-separated LinkedIn, Instagram, Twitter profile IDs (in that order)
- `WEBSITE_API_TOKEN` / `WEBSITE_API_SECRET` — from your Acme Ltd admin
- `MONGODB_URI` — if using MongoDB for caching

All AI calls go through the [Vercel AI Gateway](https://vercel.com/ai-gateway) via the AI SDK. The default model is `anthropic/claude-sonnet-5.5`; set `AI_GATEWAY_MODEL` to switch to any other gateway model without code changes.

### 3. Run Development

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 4. Test Photo Upload

1. Drop a job site photo onto the upload area (or click to browse)
2. Add optional job details (title, sector, location)
3. Click **Generate 7 formats**
4. Review each format card — copy one, or **Copy all** / download Markdown or JSON
5. Edit posts in the **Buffer preview** and add them to your Buffer queue (requires `ENABLE_BUFFER_POSTING=true`)

## API Reference

See `docs/API.md` for full endpoint documentation.

### Quick Example

```bash
curl -X POST http://localhost:3000/api/generate-content \
  -H "Content-Type: application/json" \
  -d '{"imageData": "https://example.com/photo.jpg", "metadata": {"job_title": "Commercial HVAC Installation", "sector": "Commercial"}}'
```

## Deployment

Deploy on Vercel and point a subdomain such as `content.acme.co.uk` at it. Step-by-step: [docs/SETUP.md → Put it on a domain](docs/SETUP.md#put-it-on-a-domain).

## Security

- Every page and API route requires sign-in with a company Microsoft 365 or Google Workspace account. No passwords are stored by this app.
- Access is limited to `AUTH_ALLOWED_DOMAINS` (default `example.co.uk`) plus any addresses in `AUTH_ALLOWED_EMAILS`. Microsoft sign-ins must also come from your own tenant; Google sign-ins must be verified accounts in your Workspace.
- Sessions are encrypted cookies that expire after 12 hours.
- API keys (AI Gateway, Buffer, website) stay on the server and never reach the browser.

## Project Structure

```
src/
├── auth.js                          # Auth.js config (Microsoft 365 / Google)
├── proxy.js                         # Requires sign-in on every route
├── app/
│   ├── page.jsx                     # Upload + content UI
│   ├── login/page.jsx               # Sign-in page
│   ├── layout.jsx                   # Root layout, Inter font, toasts
│   ├── globals.css                  # Paper design tokens (Tailwind v4)
│   └── api/
│       ├── auth/[...nextauth]/route.js  # Sign-in callbacks
│       ├── generate-content/route.js  # Photo → analysis → 7 formats + keywords
│       └── buffer/route.js            # Buffer status (GET) and queue a post (POST)
├── components/
│   ├── ui/                          # shadcn/ui primitives (paper variant)
│   ├── content-workspace.jsx        # Page state: upload, generate, export
│   ├── photo-dropzone.jsx           # Drag-and-drop upload, resizes in browser
│   ├── content-card.jsx             # One card per content format
│   └── buffer-preview.jsx           # Editable post preview + send to Buffer
└── lib/
    ├── ai.js                        # Vercel AI Gateway calls (AI SDK)
    ├── access.js                    # Who may sign in
    ├── session.js                   # Session check for API routes
    ├── content-generator.js         # Prompt templates for each format
    ├── formats.js                   # Format definitions, copy/export text
    ├── buffer.js                    # Buffer.com integration
    ├── website-api.js               # Acme Ltd API client
    └── image-analyzer.js            # Image analysis helpers

docs/
├── API.md                       # Full API documentation
└── SETUP.md                     # Detailed setup guide

tests/
├── photo-generation.test.js
├── formats.test.js
└── access.test.js
```

## Configuration

### Feature Flags

Enable/disable features in `.env.local`:

```env
ENABLE_BUFFER_POSTING=true       # Auto-post to Buffer
ENABLE_LEADS_SCRAPER=false       # Find leads (coming Phase 2)
ENABLE_WEBSITE_AUTO_POST=true    # Auto-create website drafts
```

### Supported Services

**Content Platforms:**
- LinkedIn
- Instagram
- Twitter
- Google My Business
- Blog/Website
- Email newsletters (coming)

**Integrations:**
- Buffer.com (scheduling)
- Acme Ltd website API
- Google Maps (Phase 3)
- LinkedIn API (Phase 3)

## Development

### Run Tests

```bash
npm test          # watch mode
npm run test:ci   # single run
```

### Run Linter

```bash
npm run lint
```

### Build for Production

```bash
npm run build
npm run start
```

## Roadmap

| Phase | Feature | Timeline | Status |
|-------|---------|----------|--------|
| 1 | Photo upload + content generation | Week 1-2 | 🚀 In Progress |
| 1 | Buffer.com integration | Week 1-2 | 🚀 In Progress |
| 1 | Website case study auto-post | Week 1-2 | 🚀 In Progress |
| 2 | Content performance analytics | Week 3-4 | ⏳ Coming |
| 2 | Keyword difficulty analyzer | Week 3 | ⏳ Coming |
| 3 | Leads scraper (Google + LinkedIn) | Week 5-6 | 📅 Planned |
| 3 | Personalized outreach generator | Week 6 | 📅 Planned |
| 3 | Warm lead tracking | Week 6 | 📅 Planned |

## Support

- 📖 Read `docs/SETUP.md` for detailed setup
- 🔧 Check `docs/API.md` for API usage
- 💬 Discuss in GitHub Issues
- ✉️ Email: ben.wilson@example.co.uk

## License

Private — Acme Ltd only

## Authors

- Ben Wilson (@benw) — Lead Developer
- Acme Ltd Team

---

**Built with ❤️ to help Acme Ltd win more work**
