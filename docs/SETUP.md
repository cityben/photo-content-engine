# Setup Guide — Photo Content Engine

## Prerequisites

- Node.js 18+ installed
- Git installed and configured
- GitHub account
- Keys for: Vercel AI Gateway, Buffer, Acme Ltd website

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/photo-content-engine.git
cd photo-content-engine
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your API keys:

```env
AI_GATEWAY_API_KEY=...              # vercel.com → AI Gateway → API Keys
BUFFER_API_TOKEN=...                # Get from buffer.com/developers
BUFFER_PROFILE_IDS=li_id,ig_id,x_id # LinkedIn, Instagram, Twitter — in that order
WEBSITE_API_TOKEN=...               # Ask Acme Ltd admin
WEBSITE_API_SECRET=...              # Ask Acme Ltd admin
MONGODB_URI=...                     # For caching (optional)
```

### 4. Verify Setup

```bash
npm run dev
```

Visit `http://localhost:3000` — you should see the upload interface.

## Get Your API Keys

### Vercel AI Gateway Key

All AI calls (photo analysis and content writing) go through the Vercel AI Gateway — no Anthropic key is needed.

1. Go to your Vercel dashboard → **AI Gateway**
2. Click **API Keys** → **Create Key**
3. Paste it into `.env.local` as `AI_GATEWAY_API_KEY`

On Vercel deployments the key is optional: the AI SDK authenticates with the project's OIDC token automatically. For local dev you can also run `vercel env pull` to fetch a short-lived OIDC token instead of creating a key.

The default model is `anthropic/claude-sonnet-5.5`. Set `AI_GATEWAY_MODEL` to any gateway model ID to change it.

### Buffer API Token

1. Go to [buffer.com/developers](https://buffer.com/developers)
2. Click **Create Application**
3. Complete the OAuth flow
4. Copy your **Access Token**
5. Paste into `.env.local`
6. **Also add your Buffer profile IDs:**
   - Go to buffer.com/app/home
   - Click Settings → Connected Accounts
   - Note your LinkedIn, Instagram, Twitter IDs
   - Paste comma-separated in `BUFFER_PROFILE_IDS`

### Acme Ltd Website API Token

Contact your Acme Ltd admin or Ben Wilson for an API token.

## Testing

### Run Unit Tests

```bash
npm test
```

### Test Photo Upload

1. Start dev server: `npm run dev`
2. Open `http://localhost:3000`
3. Upload a job site photo
4. Click "Generate Content"
5. Review 7 content formats

### Test Buffer Integration

1. Set `ENABLE_BUFFER_POSTING=true` in `.env.local`
2. Upload a photo
3. Click "Post to Buffer"
4. Check buffer.com/app to see drafted posts

## Deployment

### Deploy to Vercel (Free)

```bash
npm i -g vercel
vercel
```

Follow prompts to connect your GitHub repo.

Add `BUFFER_API_TOKEN`, `BUFFER_PROFILE_IDS`, `WEBSITE_API_TOKEN`, `WEBSITE_API_SECRET` and any feature flags under **Project → Settings → Environment Variables**. `AI_GATEWAY_API_KEY` is only needed if you turn off Vercel OIDC.

The API routes have no authentication yet — enable **Deployment Protection** so only your team can use the app.

## Troubleshooting

### "Unauthenticated. Configure AI_GATEWAY_API_KEY"

- Verify `.env.local` has `AI_GATEWAY_API_KEY` (or run `vercel env pull` for an OIDC token)
- Restart dev server: `npm run dev`
- Check the key and credit balance in Vercel → AI Gateway

### "Buffer API error: 401"

- Verify `BUFFER_API_TOKEN` in `.env.local`
- Check token hasn't expired (re-generate if needed)
- Confirm profile IDs are correct in `BUFFER_PROFILE_IDS`

### "Website API failed"

- Verify `WEBSITE_API_TOKEN` is correct
- Check website API is accessible: `WEBSITE_API_BASE`
- Ask Acme Ltd admin to verify token

### Image Upload Fails

- Supported formats: JPG, PNG, WebP (export iPhone HEIC photos as JPG)
- Photos are resized to 1600px in the browser before upload, so large camera files are fine up to 20MB
- Check browser console for error details

## Project Structure Reference

```
src/
├── app/
│   ├── page.jsx                    # Upload + content UI
│   └── api/
│       ├── generate-content/route.js  # Main photo processing endpoint
│       └── buffer/route.js            # Buffer status + queue a post
├── components/                     # UI (shadcn/ui primitives in ui/)
└── lib/
    ├── ai.js                       # Vercel AI Gateway calls
    ├── content-generator.js        # Prompt templates
    ├── formats.js                  # Copy/export formatting
    ├── image-analyzer.js           # Image processing helpers
    ├── buffer.js                   # Buffer API integration
    └── website-api.js              # Website API client

docs/
├── API.md                          # API reference
└── SETUP.md                        # This file
```

## Next Steps

### Phase 1 (MVP)

- [x] Photo upload
- [x] Content generation (7 formats)
- [x] Buffer integration
- [ ] Website auto-post
- [x] Simple UI

### Phase 2

- [ ] Content performance analytics
- [ ] Keyword difficulty analyzer
- [ ] Web UI dashboard

### Phase 3

- [ ] Leads scraper
- [ ] Personalized outreach
- [ ] Warm lead tracking

## Support

- 📖 Read `docs/API.md` for API documentation
- 🐛 Report bugs in GitHub Issues
- ✉️ Email: ben.wilson@example.co.uk

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm test` | Run tests (watch) |
| `npm run test:ci` | Run tests once |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Check code quality |

Happy building! 🚀
