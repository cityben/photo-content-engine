/**
 * AI module: structured output request and clean-up (AI SDK mocked)
 */

jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: { object: jest.fn((opts) => ({ kind: 'object', ...opts })) },
}));

import { generateText } from 'ai';

import { cleanContent, generateJobContent } from '../src/lib/ai';

describe('cleanContent', () => {
  it('keeps only services the website knows and normalises hashtags', () => {
    const out = cleanContent({
      caseStudy: { services: ['VRF / VRV Systems', 'Made-up Service'] },
      linkedin: { text: 'x', hashtags: ['HVAC', '#HVAC', ' #London ', '#A', '#B', '#C', '#D'] },
    });
    expect(out.caseStudy.services).toEqual(['VRF / VRV Systems']);
    expect(out.linkedin.hashtags).toEqual(['#HVAC', '#London', '#A', '#B', '#C']);
  });
});

describe('generateJobContent', () => {
  it('asks for only the requested sections and includes search data and the write-up', async () => {
    generateText.mockResolvedValueOnce({ output: { linkedin: { text: 'Post', hashtags: ['#HVAC'], firstComment: '' } } });
    const result = await generateJobContent(
      { title: 'VRF swap', writeUp: 'Replaced four splits with VRF.', images: [] },
      { sections: ['linkedin'], searchData: { rows: [{ key: 'vrf london', clicks: 3, impressions: 400, ctr: 0.0075, position: 8.2, positionChange: 1.1 }] } }
    );
    const call = generateText.mock.calls[0][0];
    expect(call.model).toBe('anthropic/claude-sonnet-5.5');
    expect(Object.keys(call.output.schema.shape)).toEqual(['linkedin']);
    const prompt = call.messages[0].content.at(-1).text;
    expect(prompt).toContain('Replaced four splits with VRF.');
    expect(prompt).toContain('vrf london | clicks 3 | impr 400');
    expect(result.linkedin.text).toBe('Post');
  });
});
