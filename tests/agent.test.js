/**
 * Growth check: scoring, rule brief, checklist carry-over, and a full run of
 * the free checks against the in-memory store and sandbox Buffer.
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));

import { generateText } from 'ai';

import { finishRun, listChecklist, mergeChecklist, PRESETS, ruleBrief, runCheck, scoreFindings, startRun, updateItem } from '../src/lib/agent';
import { createJob } from '../src/lib/jobs';

const user = { email: 'ben@example.co.uk' };

describe('scoring and the rules brief', () => {
  const findings = [
    { key: 'a', severity: 'high', title: 'Follow up Acme', detail: 'Due', href: '/leads/1' },
    { key: 'b', severity: 'medium', title: 'Approve VRF', detail: 'Waiting', href: '/jobs/1' },
    { key: 'c', severity: 'low', title: 'Old data', detail: 'Stale', href: null },
  ];
  it('weights findings by severity', () => {
    expect(scoreFindings(findings)).toBe(100 - 8 - 3 - 1);
    expect(scoreFindings([])).toBe(100);
  });
  it('puts urgent items first', () => {
    const b = ruleBrief(findings);
    expect(b.checklist.map((c) => c.key)).toEqual(['a', 'b', 'c']);
    expect(b.headline).toMatch(/^1 urgent: Follow up Acme/);
    expect(b.focus).toHaveLength(3);
  });
});

describe('checklist', () => {
  it('carries items over and reopens done ones that come back', async () => {
    await mergeChecklist('r1', [{ key: 'k1', title: 'Fix the H1', why: 'x', impact: 'high', href: '/x' }]);
    let [item] = (await listChecklist()).filter((i) => i.key === 'k1');
    expect(item.status).toBe('open');
    await updateItem(item.id, { status: 'done' }, user);
    await mergeChecklist('r2', [{ key: 'k1', title: 'Fix the H1 on /services', why: 'y', impact: 'high', href: '/x' }]);
    const again = (await listChecklist()).filter((i) => i.key === 'k1');
    expect(again).toHaveLength(1);
    expect(again[0]).toMatchObject({ status: 'open', recurred: true, title: 'Fix the H1 on /services' });
  });
});

describe('a free run', () => {
  it('runs every free check, writes a brief and a checklist', async () => {
    await createJob({ title: 'VRF swap', writeUp: 'w', content: { linkedin: { text: 'Copy', hashtags: [], firstComment: '' } }, user });
    const run = await startRun({ checks: [...PRESETS.free.checks, 'refresh-ai'], useAi: true, user });
    expect(run.checks[0]).toBe('refresh-ai'); // paid refreshes run first
    for (const id of run.checks) await runCheck(run.id, id);
    generateText.mockResolvedValueOnce({
      output: {
        headline: 'Approve the VRF post',
        summary: 's',
        focus: [{ title: 'Approve', why: 'w' }, { title: 'b', why: 'w' }, { title: 'c', why: 'w' }],
        checklist: [{ key: 'approve-NOPE', title: 'Invented', why: 'x', impact: 'high', effort: 'minutes' }],
      },
      usage: { inputTokens: 1000, outputTokens: 300 },
    });
    const done = await finishRun(run.id);
    expect(done.status).toBe('done');
    expect(done.results['refresh-ai'].status).toBe('skipped'); // DataForSEO not connected
    expect(done.results.work.findings.some((x) => x.title === 'Approve “VRF swap”')).toBe(true);
    expect(done.brief.headline).toBe('Approve the VRF post');
    expect(done.brief.checklist.some((c) => c.key === 'approve-NOPE')).toBe(false); // invented keys are dropped…
    expect(done.brief.checklist.length).toBeGreaterThan(0); // …and the rules list is used instead
    expect(typeof done.brief.score).toBe('number');
  });
});
