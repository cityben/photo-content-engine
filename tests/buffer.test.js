/**
 * Buffer GraphQL client: request shapes and error handling (fetch mocked)
 */

import { createPost, deletePost, listPosts, toBufferInput, BufferError } from '../src/lib/social/buffer';

const ok = (data) => ({ ok: true, status: 200, headers: new Map(), json: async () => ({ data }) });

beforeEach(() => {
  process.env.BUFFER_API_KEY = 'test-key';
  process.env.BUFFER_ORGANIZATION_ID = 'org1';
  global.fetch = jest.fn();
});

afterEach(() => {
  delete process.env.BUFFER_API_KEY;
  delete process.env.BUFFER_ORGANIZATION_ID;
});

const lastBody = () => JSON.parse(global.fetch.mock.calls.at(-1)[1].body);

describe('toBufferInput', () => {
  const img = (n) => ({ url: `https://blob/x${n}.jpg`, width: 1600, height: 1200 });

  it('queues when no time is given and schedules when one is', () => {
    expect(toBufferInput({ service: 'linkedin', text: 'Hi' })).toMatchObject({ mode: 'addToQueue', schedulingType: 'automatic' });
    expect(toBufferInput({ service: 'linkedin', text: 'Hi', dueAt: '2026-11-03T09:30:00.000Z' })).toMatchObject({
      mode: 'customScheduled',
      dueAt: '2026-11-03T09:30:00.000Z',
    });
  });

  it('makes Instagram posts with several photos a carousel shared to feed', () => {
    const input = toBufferInput({ service: 'instagram', text: 'Hi', images: [img(1), img(2)], firstComment: 'link' });
    expect(input.metadata.instagram).toEqual({ type: 'carousel', shouldShareToFeed: true, firstComment: 'link' });
    expect(input.assets[0].image).toMatchObject({ url: 'https://blob/x1.jpg', metadata: { dimensions: { width: 1600, height: 1200 } } });
  });

  it('adds a LinkedIn first comment only when there is one', () => {
    expect(toBufferInput({ service: 'linkedin', text: 'Hi' }).metadata).toBeUndefined();
    expect(toBufferInput({ service: 'linkedin', text: 'Hi', firstComment: 'c' }).metadata).toEqual({ linkedin: { firstComment: 'c' } });
  });
});

describe('createPost', () => {
  it('sends a bearer token to the GraphQL endpoint and returns the post', async () => {
    global.fetch.mockResolvedValueOnce(
      ok({ createPost: { __typename: 'PostActionSuccess', post: { id: 'p1', text: 'Hi', status: 'scheduled', dueAt: '2026-11-03T09:30:00Z', channelService: 'LINKEDIN', assets: [] } } })
    );
    const post = await createPost({ channelId: 'c1', service: 'linkedin', text: 'Hi' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.buffer.com/graphql');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(lastBody().variables.input).toMatchObject({ channelId: 'c1', text: 'Hi', mode: 'addToQueue' });
    expect(post).toMatchObject({ id: 'p1', service: 'linkedin', status: 'scheduled' });
  });

  it('turns an error member of the union into a BufferError', async () => {
    global.fetch.mockResolvedValueOnce(ok({ createPost: { __typename: 'LimitReachedError', message: 'Queue full' } }));
    await expect(createPost({ channelId: 'c1', service: 'linkedin', text: 'Hi' })).rejects.toThrow('Queue full');
  });

  it('reports rate limits with the retry time', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 429, headers: new Map([['retry-after', '240']]), json: async () => ({}) });
    const err = await createPost({ channelId: 'c1', service: 'linkedin', text: 'Hi' }).catch((e) => e);
    expect(err).toBeInstanceOf(BufferError);
    expect(err.message).toMatch(/rate limit.*4 min/);
  });
});

describe('listPosts', () => {
  it('follows pagination and filters by status and date', async () => {
    const node = (id) => ({ node: { id, text: id, status: 'sent', channelService: 'instagram', assets: [{ type: 'image', source: `https://i/${id}` }] } });
    global.fetch
      .mockResolvedValueOnce(ok({ posts: { edges: [node('a')], pageInfo: { hasNextPage: true, endCursor: 'c1' } } }))
      .mockResolvedValueOnce(ok({ posts: { edges: [node('b')], pageInfo: { hasNextPage: false, endCursor: null } } }));
    const posts = await listPosts({ start: '2026-10-01T00:00:00Z', statuses: ['sent'] });
    expect(posts.map((p) => p.id)).toEqual(['a', 'b']);
    expect(posts[0].images).toEqual(['https://i/a']);
    expect(JSON.parse(global.fetch.mock.calls[1][1].body).variables.after).toBe('c1');
    expect(lastBody().variables.input).toMatchObject({ organizationId: 'org1', filter: { status: ['sent'], dueAt: { start: '2026-10-01T00:00:00Z' } } });
  });
});

describe('deletePost', () => {
  it('passes the id and accepts DeletePostSuccess', async () => {
    global.fetch.mockResolvedValueOnce(ok({ deletePost: { __typename: 'DeletePostSuccess', id: 'p1' } }));
    await expect(deletePost('p1')).resolves.toBe(true);
    expect(lastBody().variables.input).toEqual({ id: 'p1' });
  });
});

describe('channels across organisations', () => {
  it('lists every channel of every service in every organisation', async () => {
    delete process.env.BUFFER_ORGANIZATION_ID;
    const { listChannels } = require('../src/lib/social');
    global.fetch
      .mockResolvedValueOnce(ok({ account: { id: 'a', email: 'ben@x', organizations: [{ id: 'o1', name: 'Acme Ltd' }, { id: 'o2', name: 'Acme Air' }] } }))
      .mockImplementation(async (_url, init) => {
        const org = JSON.parse(init.body).variables.input.organizationId;
        return ok({
          channels:
            org === 'o1'
              ? [{ id: 'c1', name: 'cc', displayName: 'Acme Ltd', service: 'linkedin' }, { id: 'c2', name: 'cc-fb', service: 'facebook' }]
              : [{ id: 'c3', name: 'acmeair', service: 'googlebusiness', isDisconnected: true }],
        });
      });
    const channels = await listChannels();
    expect(channels.map((c) => [c.id, c.service, c.organizationName, c.canCompose])).toEqual([
      ['c1', 'linkedin', 'Acme Ltd', true],
      ['c2', 'facebook', 'Acme Ltd', false],
      ['c3', 'googlebusiness', 'Acme Air', false],
    ]);
    expect(channels[2].disconnected).toBe(true);
  });
});
