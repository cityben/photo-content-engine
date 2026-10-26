/**
 * Website case study fields: normalising, completeness, service links,
 * and the AI Word extraction keeping to the website's lists.
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));

import { generateText } from 'ai';

import { extractCaseStudyFromDocument } from '../src/lib/ai';
import { completeness, normaliseCaseStudy, serviceLinksFor } from '../src/lib/case-study-fields';
import { saveProfile } from '../src/lib/profile';
import { TEST_OPTIONS, TEST_PROFILE } from './fixtures/profile';

beforeAll(() => saveProfile(TEST_PROFILE));

describe('case study fields', () => {
  it('turns old single values into the lists the website stores', () => {
    const cs = normaliseCaseStudy({ company: 'Acme Mechanical', sector: '', projectType: ['Cat B Fit-out'], keyChallenges: 'Live building' });
    expect(cs).toMatchObject({ company: ['Acme Mechanical'], sector: [], projectType: ['Cat B Fit-out'], template: 'full' });
    expect(normaliseCaseStudy({}).template).toBe('simple');
  });

  it('reports what the website needs and what would make it stronger, by template', () => {
    const c = completeness({ title: 'VRF swap', description: '' });
    expect(c.required.map((m) => m.key)).toEqual(['description']);
    expect(c.recommended.map((m) => m.key)).toContain('postcode');
    expect(c.recommended.map((m) => m.key)).toContain('keyWorks');
    expect(c.recommended.map((m) => m.key)).not.toContain('keyChallenges');
    expect(completeness({ template: 'full' }).recommended.map((m) => m.key)).toContain('keyChallenges');
    expect(completeness({ title: 'x'.repeat(80), description: 'y' }).tooLong[0]).toMatchObject({ key: 'title', max: 70 });
  });

  it('builds service links from real website pages', () => {
    expect(serviceLinksFor(['VRF / VRV Systems', 'Not a service'], TEST_OPTIONS.servicePages)).toBe('VRF / VRV Systems | /services/air-conditioning/vrf-vrv-systems');
  });
});

describe('AI Word extraction', () => {
  it('sends the document and known values, and cleans the result to website values', async () => {
    generateText.mockResolvedValueOnce({
      output: {
        caseStudy: {
          template: 'simple', title: 'Rochester office VRF', description: 'Swapped splits for VRF.', company: ['Acme Air Conditioning'], sector: ['Commercial Office'], projectType: ['Refurbishment'],
          services: ['VRF / VRV Systems', 'Made-up service'], client: '', area: 'Rochester', county: 'Kent', postcode: '', durationWeeks: null,
          scopeOfWorks: '- Strip out', keyWorks: '- VRF', keyChallenges: '', deliveryHighlights: '', projectOutcome: 'Cooler office.',
          testimonialQuote: '', testimonialAuthor: '', testimonialRole: '', seoTitle: 't', metaDescription: 'm', seoH1: 'h', primaryKeyword: 'k', supportingKeywords: 'a; b', mainImageAlt: 'alt', seoNotes: 'Confirm dates.',
        },
        fromDocument: ['scopeOfWorks'], written: ['seoTitle'], notInDocument: ['postcode'], checks: ['Confirm the floor count'],
      },
      usage: { inputTokens: 2000, outputTokens: 800 },
    });
    const { result } = await extractCaseStudyFromDocument({ text: '## Scope\nStripped out eight splits.', known: { client: 'Acme' } });
    const call = generateText.mock.calls[0][0];
    expect(call.prompt).toContain('client: Acme');
    expect(call.prompt).toContain('Stripped out eight splits');
    expect(result.caseStudy.services).toEqual(['VRF / VRV Systems']);
    expect(result.caseStudy.seoServiceLinks).toBe('VRF / VRV Systems | /services/air-conditioning/vrf-vrv-systems');
    expect(result.caseStudy.testimonialEnabled).toBe(false);
    expect(result.caseStudy.durationWeeks).toBeUndefined();
    expect(result.notInDocument).toEqual(['postcode']);
  });
});
