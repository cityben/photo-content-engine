/**
 * Model catalogue: live prices, cost estimates, chosen model
 */

jest.mock('ai', () => ({
  gateway: {
    getAvailableModels: jest.fn(async () => ({
      models: [
        { id: 'anthropic/claude-haiku-5.5', name: 'Haiku 5.5', pricing: { input: '0.000001', output: '0.000005' }, modelType: 'language' },
        { id: 'anthropic/claude-sonnet-5.5', name: 'Sonnet 5.5', pricing: { input: '0.000003', output: '0.000015' }, modelType: 'language' },
        { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash', pricing: { input: '0.00000075', output: '0.00000375' }, modelType: 'language' },
        { id: 'bfl/flux', name: 'Flux', modelType: 'image' },
        { id: 'mistral/mistral-small', name: 'Mistral Small', pricing: { input: '0.0000001', output: '0.0000003' } },
      ],
    })),
  },
}));

import { DEFAULT_MODEL, estimateCost, getActiveModel, isValidModelId, modelCatalog, setActiveModel } from '../src/lib/models';

describe('modelCatalog', () => {
  it('prices the shortlist per 1M tokens and per job from live gateway data', async () => {
    const c = await modelCatalog();
    const sonnet = c.shortlist.find((m) => m.id === 'anthropic/claude-sonnet-5.5');
    expect(sonnet).toMatchObject({ available: true, inputPerM: 3, outputPerM: 15 });
    expect(sonnet.perJob).toBeCloseTo((12000 * 3 + 4000 * 15) / 1e6, 6);
    expect(c.shortlist.find((m) => m.id === 'openai/gpt-5.6-sol').available).toBe(false);
    expect(c.others.map((m) => m.id)).toEqual(['mistral/mistral-small']); // image models excluded
    expect(['anthropic/claude-haiku-5.5', 'google/gemini-3.8-flash']).toContain(c.bestValue);
  });
});

describe('active model', () => {
  it('defaults, then remembers the chosen model', async () => {
    expect(await getActiveModel()).toBe(DEFAULT_MODEL);
    await setActiveModel('google/gemini-3.8-flash', { email: 'a@b.c' });
    expect(await getActiveModel()).toBe('google/gemini-3.8-flash');
  });
});

describe('helpers', () => {
  it('estimates cost and validates ids', () => {
    expect(estimateCost({ inputPerM: 1, outputPerM: 5 }, { inputTokens: 1e6, outputTokens: 1e6 })).toBe(6);
    expect(estimateCost({ inputPerM: null, outputPerM: 5 })).toBeNull();
    expect(isValidModelId('anthropic/claude-haiku-5.5')).toBe(true);
    expect(isValidModelId('../../etc')).toBe(false);
  });
});
