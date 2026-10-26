/**
 * Website v1 API client: matches company-website's contract (fetch mocked)
 */

import { createCaseStudyDraft } from '../src/lib/website-api';

beforeEach(() => {
  process.env.WEBSITE_API_KEY = 'cc_live_test';
  global.fetch = jest.fn();
});

afterEach(() => delete process.env.WEBSITE_API_KEY);

const json = (status, body) => ({ ok: status < 400, status, json: async () => body, arrayBuffer: async () => new ArrayBuffer(8), headers: new Map([['content-type', 'image/jpeg']]) });

describe('createCaseStudyDraft', () => {
  it('uploads photos, then creates an unpublished project with only writable fields', async () => {
    global.fetch
      .mockResolvedValueOnce(json(200, null)) // fetch photo 1 bytes
      .mockResolvedValueOnce(json(201, { data: { url: '/uploads/a.jpg' } }))
      .mockResolvedValueOnce(json(200, null)) // fetch photo 2 bytes
      .mockResolvedValueOnce(json(201, { data: { url: '/uploads/b.jpg' } }))
      .mockResolvedValueOnce(json(201, { data: { _id: 'p1', slug: 'vrf-canary-wharf', published: false } }));

    const result = await createCaseStudyDraft({
      caseStudy: { title: 'VRF', description: 'Lede', company: 'Acme Air Conditioning', services: ['VRF / VRV Systems'], metadata: { junk: 1 }, publishedAt: null, client: '' },
      photos: [{ url: 'https://blob/1.jpg', alt: 'Hero' }, { url: 'https://blob/2.jpg' }],
      idempotencyKey: 'job-1',
    });

    const upload = global.fetch.mock.calls[1];
    expect(upload[0]).toBe('https://www.example.co.uk/api/v1/uploads');
    expect(upload[1].headers.Authorization).toBe('Bearer cc_live_test');
    expect(upload[1].body.get('file')).toBeTruthy();

    const [url, init] = global.fetch.mock.calls[4];
    expect(url).toBe('https://www.example.co.uk/api/v1/projects');
    expect(init.headers['Idempotency-Key']).toBe('job-1');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ title: 'VRF', published: false, mainImage: '/uploads/a.jpg', images: ['/uploads/a.jpg', '/uploads/b.jpg'] });
    expect(body).not.toHaveProperty('metadata');
    expect(body).not.toHaveProperty('publishedAt');
    expect(body).not.toHaveProperty('client');
    expect(result).toMatchObject({ slug: 'vrf-canary-wharf', status: 'draft', url: 'https://www.example.co.uk/case-studies/vrf-canary-wharf' });
  });

  it('surfaces validation errors with their field details', async () => {
    global.fetch.mockResolvedValueOnce(json(422, { error: { code: 'validation_failed', message: 'Validation failed', details: { description: 'required' } } }));
    await expect(createCaseStudyDraft({ caseStudy: { title: 'X' } })).rejects.toThrow('Validation failed (description: required)');
  });
});
