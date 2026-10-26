/**
 * Buffer's daily limit is small: reads are cached and shared, identical
 * calls merge, a 429 stops all requests until Buffer's wait is over, and
 * the last saved data is shown meanwhile.
 */

import { block, cachedRead, resetBudget, usage } from '../src/lib/social/budget';
import { getPost, listChannels, listPosts } from '../src/lib/social';

const ok = (data, headers = []) => ({ ok: true, status: 200, headers: new Map(headers), json: async () => ({ data }) });
const channels = { channels: [{ id: 'c1', name: 'Acme', service: 'linkedin' }] };
const posts = { posts: { edges: [{ node: { id: 'p1', text: 'Hi', status: 'scheduled', channelService: 'linkedin' } }], pageInfo: { hasNextPage: false } } };

beforeEach(async () => {
  await resetBudget();
  process.env.BUFFER_API_KEY = 'test-key';
  process.env.BUFFER_ORGANIZATION_ID = 'org1';
  global.fetch = jest.fn();
});

afterEach(() => {
  delete process.env.BUFFER_API_KEY;
  delete process.env.BUFFER_ORGANIZATION_ID;
});

it('reads channels from Buffer once, then from the saved copy', async () => {
  global.fetch.mockResolvedValue(ok(channels, [['ratelimit-remaining', '97']]));
  await listChannels();
  await listChannels();
  await listChannels();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const u = await usage();
  expect(u.last24h).toBe(1);
  expect(u.limits).toEqual({ 'ratelimit-remaining': '97' });
});

it('merges identical calls made at the same time', async () => {
  global.fetch.mockResolvedValue(ok(posts));
  const args = { start: '2026-10-26T00:00:00Z', statuses: ['scheduled'] };
  await Promise.all([listPosts(args), listPosts(args), listPosts(args)]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('stops asking after a 429 and shows the last saved data', async () => {
  global.fetch.mockResolvedValueOnce(ok(channels));
  await listChannels();
  // Force the saved copy to be stale, then hit the limit.
  global.fetch.mockResolvedValueOnce({ ok: false, status: 429, headers: new Map([['retry-after', '72000']]), json: async () => ({}) });
  const fresh = await cachedRead('posts:test', 0, async () => {
    const { listPosts: raw } = require('../src/lib/social/buffer');
    return raw({});
  }).catch((e) => e);
  expect(fresh.status).toBe(429);
  expect(fresh.message).toMatch(/used up until .*in 20 hours/);
  expect((await usage()).blockedUntil).toBeTruthy();

  global.fetch.mockClear();
  await expect(getPost('p1')).rejects.toThrow(/used up/);
  expect(global.fetch).not.toHaveBeenCalled();
  // Channels were saved earlier, so they still show while blocked.
  const seen = await cachedRead('channels', 0, async () => {
    throw Object.assign(new Error('blocked'), { status: 429 });
  });
  expect(seen[0].id).toBe('c1');
});

it('lets requests through again once the wait is over', async () => {
  await block(60);
  global.fetch.mockResolvedValue(ok(channels));
  await expect(listChannels()).rejects.toThrow(/used up/);
  await resetBudget();
  await expect(listChannels()).resolves.toHaveLength(1);
});
