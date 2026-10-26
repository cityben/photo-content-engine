/**
 * Integration API: key checks, safe URL fetching, and job creation from
 * known values + a real Word document
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { readDocxBuffer } from '../src/lib/docx-server';
import { createJobFromIntegration, integrationSchema, summarise } from '../src/lib/integration';
import { checkIntegrationKey, integrationKeys } from '../src/lib/integration-auth';
import { fetchPublicFile, isPrivateAddress } from '../src/lib/remote-file';

const docx = readFileSync(path.join(__dirname, 'fixtures/case-study.docx'));
const KEY = 'pce_' + 'x'.repeat(40);
const req = (auth) => ({ headers: new Map([['authorization', auth]]) });

describe('integration keys', () => {
  const keys = integrationKeys(`atlas:${KEY},short:abc`);

  it('accepts a configured key and ignores keys under 32 characters', () => {
    expect(keys.map((k) => k.name)).toEqual(['atlas']);
    expect(checkIntegrationKey(req(`Bearer ${KEY}`), keys)).toBe('atlas');
    expect(checkIntegrationKey(req('Bearer abc'), keys)).toBeNull();
    expect(checkIntegrationKey(req(''), keys)).toBeNull();
  });
});

describe('fetchPublicFile', () => {
  it('only fetches https from public addresses', async () => {
    await expect(fetchPublicFile('http://example.com/x.jpg')).rejects.toThrow(/https/);
    await expect(fetchPublicFile('https://127.0.0.1/x.jpg')).rejects.toThrow(/public internet/);
    await expect(fetchPublicFile('https://169.254.169.254/latest')).rejects.toThrow(/public internet/);
    expect(isPrivateAddress('10.1.2.3')).toBe(true);
    expect(isPrivateAddress('::ffff:192.168.0.1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });
});

describe('readDocxBuffer', () => {
  it('reads headings, bold headings, tables, bullets and photos', async () => {
    const { blocks, photos } = await readDocxBuffer(docx);
    expect(blocks).toEqual(
      expect.arrayContaining([
        { type: 'heading', text: 'VRF Replacement, 30 South Colonnade' },
        { type: 'p', text: 'Client: Canary Wharf Group' },
        { type: 'li', text: 'Strip out four split systems' },
        { type: 'heading', text: 'Key Challenges' },
      ])
    );
    expect(photos).toHaveLength(1);
  });

  it('rejects files that are not .docx', async () => {
    await expect(readDocxBuffer(Buffer.from('not a zip'))).rejects.toThrow(/\.docx/);
  });
});

describe('createJobFromIntegration', () => {
  it('builds a draft job: known values win, the document fills the rest', async () => {
    const input = integrationSchema.parse({
      externalId: 'atlas-123',
      details: { sector: 'Commercial Office', client: 'CWG (known)', completedOn: '2026-04' },
    });
    const { job, created, warnings } = await createJobFromIntegration(input, { document: docx }, { keyName: 'atlas' });
    expect(created).toBe(true);
    expect(warnings).toEqual([]);
    expect(job.content.caseStudy).toMatchObject({
      title: 'VRF Replacement, 30 South Colonnade',
      client: 'CWG (known)',
      sector: 'Commercial Office',
      company: 'Acme Air Conditioning',
      area: 'Canary Wharf',
      county: 'London',
      scopeOfWorks: '- Strip out four split systems\n- Install VRF outdoor units and cassettes',
      keyChallenges: 'Occupied building: works phased floor by floor.',
    });
    expect(job.details.completedOn).toBe('2026-04');
    expect(job.images).toHaveLength(1);
    expect(job.createdBy).toBe('api:atlas');

    const s = summarise(job, 'https://content.example');
    expect(s).toMatchObject({ externalId: 'atlas-123', url: `https://content.example/jobs/${job.id}`, needsApproval: ['caseStudy'], posts: [] });
  });

  it('returns the existing job for a repeated externalId', async () => {
    const input = integrationSchema.parse({ externalId: 'atlas-123', title: 'Again' });
    const { created, warnings } = await createJobFromIntegration(input, {}, { keyName: 'atlas' });
    expect(created).toBe(false);
    expect(warnings[0]).toMatch(/already exists/);
  });

  it('works from known values alone', async () => {
    const input = integrationSchema.parse({ title: 'Plant room upgrade', writeUp: 'Two boilers replaced.', details: { sector: 'Healthcare' } });
    const { job } = await createJobFromIntegration(input, {}, { keyName: 'atlas' });
    expect(job).toMatchObject({ title: 'Plant room upgrade', writeUp: 'Two boilers replaced.', content: {} });
    expect(job.details.sector).toBe('Healthcare');
  });

  it('rejects bad input', () => {
    expect(integrationSchema.safeParse({ details: { completedOn: 'March' } }).success).toBe(false);
  });
});
