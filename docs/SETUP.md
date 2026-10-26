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

Everyone signs in with an email and password you give them. Microsoft 365 sign-in can be switched on as well, later.

First, generate a secret that encrypts session cookies, and add it as `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

#### Add a person

There's no sign-up page — you create each account. Run this on your own machine (after `npm install`) or in a GitHub Codespace, **not** anywhere the password would be logged or shared:

```bash
npm run hash-password -- ben@example.co.uk
```

It asks for the password (hidden, at least 12 characters) and prints one line like:

```
ben@example.co.uk|scrypt.15.8.1.ikXZaRn...
```

Put that line in `AUTH_USERS`. For several people, separate the lines with commas:

```env
AUTH_USERS=ben@example.co.uk|scrypt...,sam@example.co.uk|scrypt...
```

The line holds a one-way hash, not the password, but still treat it as a secret. To **change a password** run the command again and replace that person's entry; to **remove someone** delete their entry. On Vercel, redeploy after changing `AUTH_USERS` so it takes effect.

After 5 wrong passwords for an email (or from one IP address) within 15 minutes, sign-in is paused for 15 minutes. Sessions expire after 12 hours.

#### Microsoft 365 (optional)

Shows a "Continue with Microsoft 365" button alongside the password form. Skip this until you want it.

1. Go to [entra.microsoft.com](https://entra.microsoft.com) → **Applications → App registrations → New registration**
2. Name: `Photo Content Engine`. Supported account types: **Accounts in this organizational directory only (Single tenant)**
3. Redirect URI: platform **Web**, URL `http://localhost:3000/api/auth/callback/microsoft-entra-id` (add your live URL later, see below)
4. After creating it, copy from the **Overview** page:
   - **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`
   - **Directory (tenant) ID** → put it into `AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0`
5. **Certificates & secrets → New client secret** → copy the **Value** → `AUTH_MICROSOFT_ENTRA_ID_SECRET`

The tenant ID is required: the app rejects Microsoft accounts from any other organisation, even if their email looks like yours. Within your tenant, only emails on `AUTH_ALLOWED_DOMAINS` (default `example.co.uk`) or `AUTH_ALLOWED_EMAILS` get in.

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
| `AUTH_USERS` | Yes — see [Add a person](#add-a-person) |
| `AUTH_MICROSOFT_ENTRA_ID_ID`, `_SECRET`, `_ISSUER` | Only if using Microsoft 365 sign-in |
| `BUFFER_API_TOKEN`, `BUFFER_PROFILE_IDS` | For Buffer |
| `ENABLE_BUFFER_POSTING` | `true` to send posts to Buffer |
| `WEBSITE_API_TOKEN`, `WEBSITE_API_SECRET` | For website drafts |
| `AI_GATEWAY_API_KEY` | No — Vercel signs in to the AI Gateway automatically |

Then **Deploy**. You get a URL like `photo-content-engine.vercel.app` straight away — that's enough to test with; steps 3–4 are optional.

**3. Add your own domain**

1. Project → **Settings → Domains → Add** → enter e.g. `content.acme.co.uk`
2. Vercel shows a DNS record — usually a **CNAME** for `content` pointing to `cname.vercel-dns.com`. Add it wherever your domain's DNS is managed (your registrar, Cloudflare, etc.)
3. Wait for the domain to show **Valid Configuration** (minutes, occasionally up to a few hours). HTTPS is set up automatically.

**4. Microsoft sign-in only: register the live URL**

If you turned on Microsoft 365 sign-in, add the live callback URL to the app registration alongside the localhost one, e.g. `https://content.acme.co.uk/api/auth/callback/microsoft-entra-id`. Password sign-in needs nothing here.

**5. Test it**

Open the URL in a browser, sign in with an email and password from `AUTH_USERS`, upload a photo. Every push to `main` redeploys automatically.

## Troubleshooting

### Sign-in fails

- **"That email and password don't match"** — check the entry in `AUTH_USERS` (no spaces inside it, entries separated by commas) and that you redeployed after changing it. After 5 failures, wait 15 minutes
- **"No accounts are set up yet"** — `AUTH_USERS` is empty or every entry is malformed
- **"Sign-in isn't set up correctly"** — `AUTH_SECRET` is missing, or a Microsoft client ID/secret is wrong. The server logs say which
- **"That Microsoft account doesn't have access"** — the account is from a different tenant, or its email isn't on `AUTH_ALLOWED_DOMAINS` / `AUTH_ALLOWED_EMAILS`
- **Microsoft "redirect URI mismatch"** — add the exact callback URL from step 4 above

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
| `npm run hash-password -- <email>` | Create an `AUTH_USERS` entry |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Check code quality |

Happy building! 🚀
