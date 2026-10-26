/**
 * AI module: structured output request and clean-up (AI SDK mocked)
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [{ id: 'anthropic/claude-sonnet-5.5', name: 'Sonnet', pricing: { input: '0.000003', output: '0.000015' } }] })) },
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
    generateText.mockResolvedValueOnce({
      output: { linkedin: { text: 'Post', hashtags: ['#HVAC'], firstComment: '' } },
      usage: { inputTokens: 10000, outputTokens: 2000 },
    });
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
    expect(result.content.linkedin.text).toBe('Post');
    // 10k in × $3/M + 2k out × $15/M = $0.06, from live gateway prices
    expect(result.run).toMatchObject({ model: 'anthropic/claude-sonnet-5.5', full: false, inputTokens: 10000, outputTokens: 2000 });
    expect(result.run.costUsd).toBeCloseTo(0.06, 5);
  });

  it('uses a model override for one run', async () => {
    generateText.mockResolvedValueOnce({ output: { linkedin: { text: 'x', hashtags: [], firstComment: '' } }, usage: {} });
    const { run } = await generateJobContent({ title: 't', writeUp: 'w', images: [] }, { sections: ['linkedin'], model: 'google/gemini-3.8-flash' });
    expect(generateText.mock.calls.at(-1)[0].model).toBe('google/gemini-3.8-flash');
    expect(run.model).toBe('google/gemini-3.8-flash');
  });
});
