# Setup Guide — Photo Content Engine

## Prerequisites

- Node.js 18+ installed
- Git installed and configured
- GitHub account
- API keys for: Claude (Anthropic), Buffer, Acme Ltd website

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
ANTHROPIC_API_KEY=sk-...           # Get from console.anthropic.com
BUFFER_API_TOKEN=...                # Get from buffer.com/developers
WEBSITE_API_TOKEN=...               # Ask Acme Ltd admin
MONGODB_URI=...                     # For caching (optional)
```

### 4. Verify Setup

```bash
npm run dev
```

Visit `http://localhost:3000` — you should see the upload interface.

## Get Your API Keys

### Claude API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in or create account
3. Click **API Keys** on the left
4. Click **Create Key**
5. Copy and paste into `.env.local`

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

### Deploy to Claude Cloud

1. Push to GitHub:
   ```bash
   git push origin main
   ```

2. Claude Cloud will auto-deploy via GitHub Actions

3. Check `.github/workflows/deploy.yml` for deployment config

## Troubleshooting

### "ANTHROPIC_API_KEY not found"

- Verify `.env.local` has the key
- Restart dev server: `npm run dev`
- Check key is valid in console.anthropic.com

### "Buffer API error: 401"

- Verify `BUFFER_API_TOKEN` in `.env.local`
- Check token hasn't expired (re-generate if needed)
- Confirm profile IDs are correct in `BUFFER_PROFILE_IDS`

### "Website API failed"

- Verify `WEBSITE_API_TOKEN` is correct
- Check website API is accessible: `WEBSITE_API_BASE`
- Ask Acme Ltd admin to verify token

### Image Upload Fails

- Max file size: 10MB
- Supported formats: JPG, PNG, WebP
- Check browser console for error details

## Project Structure Reference

```
src/
├── api/
│   └── generate-content.js         # Main photo processing endpoint
├── lib/
│   ├── content-generator.js        # Prompt templates
│   ├── image-analyzer.js           # Image processing helpers
│   ├── buffer.js                   # Buffer API integration
│   └── website-api.js              # Website API client
└── public/
    └── (UI coming in Phase 2)

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
- [ ] Simple UI

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
| `npm test` | Run tests |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Check code quality |

Happy building! 🚀
