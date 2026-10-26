/**
 * Market analysis helpers and the DataForSEO client (fetch mocked)
 */

import { auditIssues, cleanDomain, isValidDomain, keywordRow, linkProspects, opportunityScore, organic, reviewStats, trendPercent } from '../src/lib/seo/analysis';

describe('trendPercent', () => {
  const months = (recent, old) => {
    const rows = [];
    for (let i = 0; i < 15; i++) {
      const d = new Date(Date.UTC(2026, 8 - i, 1));
      rows.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, search_volume: i < 3 ? recent : i >= 12 ? old : 50 });
    }
    return rows;
  };
  it('compares the last 3 months with the same months a year earlier', () => {
    expect(trendPercent(months(150, 100))).toBe(50);
    expect(trendPercent(months(80, 100))).toBe(-20);
  });
  it('needs 15 months of data', () => {
    expect(trendPercent(months(1, 1).slice(0, 10))).toBeNull();
  });
});

describe('opportunityScore', () => {
  it('prefers valuable, easy, buying-intent keywords and quick wins', () => {
    const base = { volume: 500, cpc: 8, difficulty: 30, intent: 'commercial' };
    expect(opportunityScore(base)).toBeGreaterThan(opportunityScore({ ...base, difficulty: 80 }));
    expect(opportunityScore(base)).toBeGreaterThan(opportunityScore({ ...base, intent: 'informational' }));
    expect(opportunityScore({ ...base, ourPosition: 8 })).toBeGreaterThan(opportunityScore(base));
    const s = opportunityScore(base);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe('row helpers', () => {
  it('flattens keyword data with or without the wrapper', () => {
    const kd = { keyword: 'vrf london', keyword_info: { search_volume: 320, cpc: 9.5, monthly_searches: [] }, keyword_properties: { keyword_difficulty: 22 }, search_intent_info: { main_intent: 'commercial' } };
    expect(keywordRow(kd)).toMatchObject({ keyword: 'vrf london', volume: 320, cpc: 9.5, difficulty: 22, intent: 'commercial' });
    expect(keywordRow({ keyword_data: kd }).keyword).toBe('vrf london');
  });
  it('reads organic metrics', () => {
    expect(organic({ organic: { etv: 1234.6, count: 400, pos_1: 3, pos_2_3: 7, pos_4_10: 20 } })).toMatchObject({ traffic: 1235, keywords: 400, top3: 10, top10: 30 });
  });
  it('normalises and validates domains', () => {
    expect(cleanDomain('https://www.Example.co.uk/page')).toBe('example.co.uk');
    expect(isValidDomain('example.co.uk')).toBe(true);
    expect(isValidDomain('not a domain')).toBe(false);
  });
});

describe('dataforseo client', () => {
  const { post, monthSpend } = require('../src/lib/seo/dataforseo');
  beforeEach(() => {
    process.env.DATAFORSEO_LOGIN = 'me@x.com';
    process.env.DATAFORSEO_PASSWORD = 'pw';
    process.env.DATAFORSEO_MONTHLY_BUDGET = '0.05';
    global.fetch = jest.fn();
  });

  it('sends one task in an array with Basic auth and logs the cost', async () => {
    global.fetch.mockResolvedValueOnce({ status: 200, json: async () => ({ status_code: 20000, cost: 0.03, tasks: [{ status_code: 20000, result: [{ items: [] }] }] }) });
    const { cost } = await post('/v3/dataforseo_labs/google/ranked_keywords/live', { target: 'a.co.uk' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('me@x.com:pw').toString('base64')}`);
    expect(JSON.parse(init.body)).toEqual([{ target: 'a.co.uk' }]);
    expect(cost).toBe(0.03);
    expect(await monthSpend()).toBeCloseTo(0.03);
  });

  it('stops at the monthly budget and reports task errors', async () => {
    global.fetch.mockResolvedValueOnce({ status: 200, json: async () => ({ status_code: 20000, cost: 0.03, tasks: [{ status_code: 40501, status_message: 'Invalid Field' }] }) });
    await expect(post('/v3/x', {})).rejects.toThrow('Invalid Field');
    await expect(post('/v3/x', {})).rejects.toThrow(/budget/);
  });

  it('queued tasks: 20100 gives an id, 40602 means not ready yet', async () => {
    process.env.DATAFORSEO_MONTHLY_BUDGET = '100';
    const { postTask, getTask } = require('../src/lib/seo/dataforseo');
    const reply = (task) => ({ status: 200, json: async () => ({ status_code: 20000, cost: 0, tasks: [task] }) });
    global.fetch
      .mockResolvedValueOnce(reply({ id: 't-1', status_code: 20100, status_message: 'Task Created.' }))
      .mockResolvedValueOnce(reply({ id: 't-1', status_code: 40602, status_message: 'Task In Queue.' }))
      .mockResolvedValueOnce(reply({ id: 't-1', status_code: 20000, result: [{ items: [{ rating: { value: 5 } }] }] }));
    expect((await postTask('/v3/business_data/google/reviews/task_post', { keyword: 'x' })).id).toBe('t-1');
    expect(await getTask('/v3/business_data/google/reviews/task_get/t-1')).toEqual({ ready: false, cost: 0 });
    const done = await getTask('/v3/business_data/google/reviews/task_get/t-1');
    expect(done.ready).toBe(true);
    expect(done.result[0].items).toHaveLength(1);
    expect(global.fetch.mock.calls[1][1].method).toBe('GET');
  });
});

describe('reputation helpers', () => {
  it('reviewStats: average, replies, recent and distribution', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    const s = reviewStats(
      [
        { rating: 5, date: '2026-10-01 10:00:00 +00:00', replied: true },
        { rating: 4, date: '2026-09-15 10:00:00 +00:00', replied: false },
        { rating: 2, date: '2026-01-02 10:00:00 +00:00', replied: false },
        { rating: 5, date: null, replied: false },
      ],
      now
    );
    expect(s.average).toBe(4);
    expect(s.repliedShare).toBe(25);
    expect(s.last90).toBe(2);
    expect(s.unanswered).toBe(1);
    expect(s.distribution.find((d) => d.star === 5).count).toBe(2);
    expect(s.monthly.map((m) => m.month)).toEqual(['2026-01', '2026-09', '2026-10']);
  });

  it('reviewStats handles no reviews', () => {
    expect(reviewStats([])).toMatchObject({ count: 0, average: null, repliedShare: null });
  });

  it('auditIssues: true flags problems, false flags missing good things, sorted by severity', () => {
    const issues = auditIssues({ no_h1_tag: true, title_too_long: true, is_https: false, no_description: false, unknown_check: true });
    expect(issues.map((i) => i.key)).toEqual(['no_h1_tag', 'is_https', 'title_too_long']);
  });

  it('linkProspects ranks domains linking to more competitors first', () => {
    const targets = { 1: 'a.co.uk', 2: 'b.co.uk' };
    const items = [
      { domain_intersection: { 1: { target: 'dir.co.uk', rank: 40, backlinks: 2 }, 2: { target: 'dir.co.uk', rank: 40, backlinks: 0 } } },
      { domain_intersection: { 1: { target: 'www.trade.org.uk', rank: 30, backlinks: 1 }, 2: { target: 'www.trade.org.uk', rank: 30, backlinks: 3 } } },
    ];
    const p = linkProspects(items, targets);
    expect(p[0]).toMatchObject({ domain: 'trade.org.uk', linksTo: ['a.co.uk', 'b.co.uk'], backlinks: 4 });
    expect(p[1].linksTo).toEqual(['a.co.uk']);
  });
});
