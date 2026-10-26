/**
 * Website connection set from Settings: encrypted key, address normalising,
 * env fallback, and the key never leaving the server.
 */

import { hintFor, openSecret, sealSecret } from '../src/lib/secret-box';
import { checkWebsiteConnection, normaliseApiUrl, saveWebsiteConnection, websiteConfig, websiteConfigPublic } from '../src/lib/website-api';
import { collection } from '../src/lib/store';

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));
jest.mock('node:dns/promises', () => ({ lookup: jest.fn(async (host) => (host === 'intranet.local' ? [{ address: '10.0.0.5' }] : [{ address: '203.0.113.10' }])) }));

const user = { email: 'ben@example.co.uk' };

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-0123456789-abcdefghij';
  global.fetch = jest.fn();
});

describe('secret box', () => {
  it('round-trips and never stores the plain text', () => {
    const box = sealSecret('cc_live_supersecret1234');
    expect(JSON.stringify(box)).not.toContain('supersecret');
    expect(openSecret(box)).toBe('cc_live_supersecret1234');
    expect(hintFor('cc_live_supersecret1234')).toBe('cc_live_su…1234');
  });

  it("can't be opened with a different AUTH_SECRET", () => {
    const box = sealSecret('cc_live_x');
    process.env.AUTH_SECRET = 'another-secret-entirely-0123456789';
    expect(() => openSecret(box)).toThrow();
  });
});

describe('website address', () => {
  it('accepts the site, the site with a slash, or the full API URL', () => {
    for (const input of ['staging.example.co.uk', 'https://staging.example.co.uk/', 'https://staging.example.co.uk/api/v1/']) {
      expect(normaliseApiUrl(input)).toEqual({ siteUrl: 'https://staging.example.co.uk', apiBase: 'https://staging.example.co.uk/api/v1' });
    }
    expect(() => normaliseApiUrl('http://example.com')).toThrow('https');
  });
});

describe('saved connection', () => {
  it('falls back to env, then uses the saved address and encrypted key', async () => {
    process.env.WEBSITE_API_KEY = 'cc_live_fromenv0000';
    expect(await websiteConfig()).toMatchObject({ apiBase: 'https://www.example.co.uk/api/v1', keySource: 'env' });

    const pub = await saveWebsiteConnection({ apiUrl: 'https://staging.example.co.uk', apiKey: 'cc_live_saved99998888' }, user);
    expect(pub).toMatchObject({ apiBase: 'https://staging.example.co.uk/api/v1', keySource: 'settings', keyHint: 'cc_live_sa…8888', configured: true });
    expect(pub.apiKey).toBeUndefined();
    expect(JSON.stringify(await websiteConfigPublic())).not.toContain('cc_live_saved99998888');
    const [doc] = await collection('settings').find({ key: 'website-connection' });
    expect(JSON.stringify(doc)).not.toContain('saved9999');

    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { name: 'Content engine', scopes: ['content:write'] } }) });
    const check = await checkWebsiteConnection();
    expect(global.fetch.mock.calls[0][0]).toBe('https://staging.example.co.uk/api/v1/me');
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer cc_live_saved99998888');
    expect(check).toMatchObject({ ok: true });

    // Blank key keeps the saved one; clearKey falls back to env.
    await saveWebsiteConnection({ apiUrl: 'https://staging.example.co.uk' }, user);
    expect((await websiteConfig()).keySource).toBe('settings');
    await saveWebsiteConnection({ clearKey: true }, user);
    expect((await websiteConfig()).keySource).toBe('env');
    delete process.env.WEBSITE_API_KEY;
  });

  it('explains a 404 and refuses private addresses', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => null });
    const check = await checkWebsiteConnection({ apiUrl: 'https://www.example.co.uk', apiKey: 'cc_live_x' });
    expect(check.error).toMatch(/404 — https:\/\/www\.example\.co\.uk\/api\/v1 has no v1 API/);
    await expect(saveWebsiteConnection({ apiUrl: 'https://intranet.local' }, user)).rejects.toThrow('public internet');
  });
});

describe('report errors', () => {
  it('reads the website\'s string errors and explains report failures from them', async () => {
    const { getReportSummary } = require('../src/lib/website-api');
    const { reportFailure } = require('../src/lib/growth');
    process.env.WEBSITE_API_KEY = 'cc_live_x';
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'GA4 property not connected' }) });
    await expect(getReportSummary({})).rejects.toThrow('GA4 property not connected');
    expect(reportFailure(['summary: Website API error 403'])).toMatch(/analytics:read/);
    expect(reportFailure(['summary: GA4 property not connected'])).toBe("The website couldn't build its reports — summary: GA4 property not connected.");
    delete process.env.WEBSITE_API_KEY;
  });
});
