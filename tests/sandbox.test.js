/**
 * Sandbox provider: behaves like Buffer without posting anything
 */

import * as sandbox from '../src/lib/social/sandbox';

const later = (h) => new Date(Date.now() + h * 3600000).toISOString();

describe('sandbox posts', () => {
  it('schedules, edits and deletes', async () => {
    const post = await sandbox.createPost({ channelId: 'sandbox-linkedin', text: 'Hello', dueAt: later(2) });
    expect(post.status).toBe('scheduled');
    const edited = await sandbox.editPost(post.id, { text: 'Hello again' });
    expect(edited.text).toBe('Hello again');
    await sandbox.deletePost(post.id);
    expect(await sandbox.getPost(post.id)).toBeNull();
  });

  it('queues into a free weekday slot when no time is given', async () => {
    const post = await sandbox.createPost({ channelId: 'sandbox-linkedin', text: 'Queued' });
    const day = new Date(post.dueAt).getUTCDay();
    expect([1, 2, 3, 4, 5]).toContain(day);
    expect(new Date(post.dueAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('requires a photo for Instagram and a future time', async () => {
    await expect(sandbox.createPost({ channelId: 'sandbox-instagram', text: 'No photo' })).rejects.toThrow(/photo/);
    await expect(sandbox.createPost({ channelId: 'sandbox-linkedin', text: 'Past', dueAt: later(-2) })).rejects.toThrow(/future/);
  });

  it('gives sent posts stable simulated metrics and none to scheduled posts', () => {
    const sent = { id: 'abc', service: 'linkedin', status: 'sent', sentAt: later(-100) };
    const a = sandbox.simulatedMetrics(sent);
    expect(a).toEqual(sandbox.simulatedMetrics(sent));
    expect(a.find((m) => m.type === 'impressions').value).toBeGreaterThan(0);
    expect(sandbox.simulatedMetrics({ ...sent, status: 'scheduled' })).toBeNull();
  });
});

describe('media safety', () => {
  const { isOwnImageUrl, sniffImageType } = require('../src/lib/media');

  it('only accepts photo URLs this app created', () => {
    expect(isOwnImageUrl('/api/media/0d9c7439-d633-45e7-9587-9f90731c8122')).toBe(true);
    expect(isOwnImageUrl('https://abc123.public.blob.vercel-storage.com/jobs/photo-x.jpg')).toBe(true);
    expect(isOwnImageUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isOwnImageUrl('http://abc.public.blob.vercel-storage.com/x.jpg')).toBe(false);
    expect(isOwnImageUrl('https://evil.com/?.public.blob.vercel-storage.com')).toBe(false);
    expect(isOwnImageUrl('/api/media/../../etc/passwd')).toBe(false);
  });

  it('identifies images by their bytes, not their name', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
    expect(sniffImageType(new TextEncoder().encode('<html><script>'))).toBeNull();
  });
});
