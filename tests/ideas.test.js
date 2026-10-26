/**
 * Content pipeline: duplicates, linking a job, publishing, AI planner
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));

import { generateText } from 'ai';

import { createIdea, getIdea, linkJob, markPublishedForJob, targetFromIdea } from '../src/lib/ideas';
import { planIdeas } from '../src/lib/planner';
import { collection } from '../src/lib/store';

const user = { email: 'ben@example.co.uk' };

describe('content pipeline', () => {
  it('stores ideas and refuses the same keyword twice', async () => {
    const { idea, duplicate } = await createIdea({ title: 'EICR for a 6-storey office', keyword: 'EICR Commercial', volume: 480, source: 'gap' }, user);
    expect(duplicate).toBe(false);
    expect(idea).toMatchObject({ keyword: 'eicr commercial', status: 'idea', format: 'case-study', createdBy: user.email });
    const again = await createIdea({ title: 'Another EICR piece', keyword: 'eicr commercial' }, user);
    expect(again.duplicate).toBe(true);
    expect(again.idea.id).toBe(idea.id);
  });

  it('moves to in progress when a job starts, and published when the case study goes out', async () => {
    const { idea } = await createIdea({ title: 'VRF retrofit in a live office', keyword: 'vrf retrofit' }, user);
    await linkJob(idea.id, 'job-1');
    expect(await getIdea(idea.id)).toMatchObject({ status: 'in_progress', jobId: 'job-1' });
    await markPublishedForJob({ id: 'job-1', ideaId: idea.id });
    expect((await getIdea(idea.id)).status).toBe('published');
    expect(targetFromIdea(idea)).toEqual({ keyword: 'vrf retrofit', volume: null, angle: 'VRF retrofit in a live office', format: 'case-study' });
  });

  it('planner adds AI ideas with stats from stored keyword data, skipping duplicates', async () => {
    await collection('market_snapshots').insert({
      section: 'ideas',
      key: 'all',
      cost: 0,
      data: [{ keyword: 'heat pump installation commercial', volume: 390, score: 72, intent: 'commercial', difficulty: 25, trend: 60 }],
    });
    generateText.mockResolvedValueOnce({
      output: {
        ideas: [
          { title: 'Air-source heat pump for a Kent school', angle: 'Show the plant and the commissioning record.', keyword: 'Heat pump installation commercial', format: 'case-study', why: 'Rising 60% year on year.' },
          { title: 'Duplicate EICR', angle: '', keyword: 'eicr commercial', format: 'article', why: 'Gap.' },
        ],
      },
      usage: { inputTokens: 1000, outputTokens: 500 },
    });
    const r = await planIdeas(user);
    expect(r).toMatchObject({ added: 1, suggested: 2 });
    const prompt = generateText.mock.calls[0][0].prompt;
    expect(prompt).toContain('heat pump installation commercial');
    expect(prompt).toContain('eicr commercial'); // already in pipeline, so the AI is told
    const [added] = await collection('ideas').find({ keyword: 'heat pump installation commercial' });
    expect(added).toMatchObject({ source: 'ai', volume: 390, score: 72, sourceDetail: 'Rising 60% year on year.' });
  });
});
