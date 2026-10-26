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

### Sign-in

The app only lets in people with a company account. No passwords are stored — sign-in is handled by Microsoft or Google. Set up **whichever one your company email runs on** (or both).

First, generate a secret that encrypts session cookies, and add it as `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

#### Microsoft 365

1. Go to [entra.microsoft.com](https://entra.microsoft.com) → **Applications → App registrations → New registration**
2. Name: `Photo Content Engine`. Supported account types: **Accounts in this organizational directory only (Single tenant)**
3. Redirect URI: platform **Web**, URL `http://localhost:3000/api/auth/callback/microsoft-entra-id` (add your live URL later, see below)
4. After creating it, copy from the **Overview** page:
   - **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`
   - **Directory (tenant) ID** → put it into `AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0`
5. **Certificates & secrets → New client secret** → copy the **Value** → `AUTH_MICROSOFT_ENTRA_ID_SECRET`

The tenant ID is required: the app rejects Microsoft accounts from any other organisation, even if their email looks like yours.

#### Google Workspace

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create a project → **APIs & Services → OAuth consent screen**
2. User type: **Internal** (only people in your Workspace can use it)
3. **Credentials → Create credentials → OAuth client ID** → type **Web application**
4. Authorised redirect URI: `http://localhost:3000/api/auth/callback/google` (add your live URL later)
5. Copy the **Client ID** → `AUTH_GOOGLE_ID` and **Client secret** → `AUTH_GOOGLE_SECRET`

#### Who gets in

- `AUTH_ALLOWED_DOMAINS` — email domains allowed in (default `example.co.uk`)
- `AUTH_ALLOWED_EMAILS` — extra individual addresses, e.g. a marketing agency (Google sign-in only, unless they are guests in your Microsoft tenant)

Anyone else sees "That account doesn't have access". Sessions expire after 12 hours.

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

### Put it on a domain

The app runs on [Vercel](https://vercel.com) (the free Hobby plan is enough to test; use Pro for business use).

**1. Import the repo**

1. Sign in to vercel.com with GitHub
2. **Add New → Project** → pick `cityben/photo-content-engine` → **Import**
3. Framework preset is detected as Next.js; leave the build settings alone

**2. Add environment variables** (Project → Settings → Environment Variables, before the first deploy or redeploy afterwards)

| Variable | Needed? |
|---|---|
| `AUTH_SECRET` | Yes |
| `AUTH_MICROSOFT_ENTRA_ID_ID`, `_SECRET`, `_ISSUER` | If using Microsoft 365 |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | If using Google Workspace |
| `AUTH_ALLOWED_DOMAINS` | Optional (default `example.co.uk`) |
| `BUFFER_API_TOKEN`, `BUFFER_PROFILE_IDS` | For Buffer |
| `ENABLE_BUFFER_POSTING` | `true` to send posts to Buffer |
| `WEBSITE_API_TOKEN`, `WEBSITE_API_SECRET` | For website drafts |
| `AI_GATEWAY_API_KEY` | No — Vercel signs in to the AI Gateway automatically |

Then **Deploy**. You get a URL like `photo-content-engine.vercel.app` straight away.

**3. Add your own domain**

1. Project → **Settings → Domains → Add** → enter e.g. `content.acme.co.uk`
2. Vercel shows a DNS record — usually a **CNAME** for `content` pointing to `cname.vercel-dns.com`. Add it wherever your domain's DNS is managed (your registrar, Cloudflare, etc.)
3. Wait for the domain to show **Valid Configuration** (minutes, occasionally up to a few hours). HTTPS is set up automatically.

**4. Tell Microsoft/Google about the live URL**

Add the live callback URL to the app registration from [Sign-in](#sign-in), alongside the localhost one:

- Microsoft: `https://content.acme.co.uk/api/auth/callback/microsoft-entra-id`
- Google: `https://content.acme.co.uk/api/auth/callback/google`

Sign-in only works on URLs registered here. Preview deployments (the per-branch `*.vercel.app` URLs) aren't registered, so test sign-in on your main domain.

**5. Test it**

Open the domain in a browser, sign in with your company account, upload a photo. Every push to `main` redeploys automatically.

## Troubleshooting

### Sign-in fails

- **"That account doesn't have access"** — the email isn't on `AUTH_ALLOWED_DOMAINS` / `AUTH_ALLOWED_EMAILS`, or (Microsoft) it belongs to a different tenant, or (Google) it's a personal Gmail rather than a Workspace account
- **"Sign-in isn't set up correctly"** — `AUTH_SECRET` is missing, or a client ID/secret is wrong. The server logs say which
- **Microsoft/Google "redirect URI mismatch"** — add the exact callback URL from step 4 above
- **"No sign-in method is configured"** — neither the Microsoft nor the Google variables are set

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
