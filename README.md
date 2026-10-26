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
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `BUFFER_API_TOKEN` — from buffer.com/developers
- `WEBSITE_API_TOKEN` — from your Acme Ltd admin
- `MONGODB_URI` — if using MongoDB for caching

### 3. Run Development

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 4. Test Photo Upload

1. Click **Upload Photo**
2. Select a job site image
3. Add optional metadata (job title, sector, location)
4. Click **Generate Content**
5. View all 7 formats
6. Export or post to Buffer

## API Reference

See `docs/API.md` for full endpoint documentation.

### Quick Example

```bash
curl -X POST http://localhost:3000/api/generate-content \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@photo.jpg" \
  -F "job_title=Commercial HVAC Installation" \
  -F "sector=Commercial"
```

## Deployment

### Deploy to Vercel (Free)

```bash
npm i -g vercel
vercel
```

### Deploy to Claude Cloud

Push to GitHub — Claude Cloud auto-deploys:

```bash
git push origin main
```

## Project Structure

```
src/
├── api/
│   ├── generate-content.js      # Main handler for photo → content
│   ├── find-leads.js            # Leads scraper (Phase 3)
│   └── track-engagement.js      # Analytics (Phase 2)
├── lib/
│   ├── claude.js                # Claude API wrapper
│   ├── content-generator.js     # Prompt templates for each format
│   ├── buffer.js                # Buffer.com integration
│   ├── website-api.js           # Acme Ltd API client
│   └── image-analyzer.js        # Image analysis helpers
├── models/
│   ├── Lead.js                  # MongoDB: Lead records
│   ├── CachePhoto.js            # MongoDB: Photo cache
│   └── OutreachLog.js           # MongoDB: Outreach tracking
└── public/
    └── (UI coming in Phase 2)

docs/
├── API.md                       # Full API documentation
├── SETUP.md                     # Detailed setup guide
└── ARCHITECTURE.md              # Technical design

tests/
├── photo-generation.test.js
└── leads-scraper.test.js
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
npm test
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
