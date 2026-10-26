/**
 * Dashboard analysis: why a search isn't ranking, what's working, what's
 * trending and the competitor table — all from stored data.
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));

import { competitorMoves, competitorTable, expectedCtr, rankingDiagnosis, whatsTrending, whatsWorking } from '../src/lib/dashboard';

describe('why you are not ranking', () => {
  const input = {
    queries: [
      { key: 'vrf installation london', impressions: 400, clicks: 4, ctr: 0.01, position: 6.2, positionChange: -2 },
      { key: 'brand name', impressions: 900, clicks: 300, ctr: 0.33, position: 1.1 },
      { key: 'rare search', impressions: 5, clicks: 0, ctr: 0, position: 30 },
    ],
    ranked: [{ keyword: 'vrf installation london', position: 6, url: 'https://www.example.co.uk/vrf' }],
    demand: [
      { keyword: 'commercial air conditioning maintenance', volume: 480, difficulty: 62, intent: 'commercial', ourPosition: null, score: 70 },
      { keyword: 'what is hvac', volume: 9000, difficulty: 20, intent: 'informational', ourPosition: null, score: 40 },
    ],
    gaps: [{ competitor: 'rival.co.uk', rows: [{ keyword: 'commercial air conditioning maintenance', volume: 480, intent: 'commercial', theirPosition: 2, theirUrl: 'https://rival.co.uk/maintenance' }] }],
    backlinks: [
      { domain: 'example.co.uk', you: true, referringDomains: 40 },
      { domain: 'rival.co.uk', referringDomains: 300 },
    ],
    audit: [{ url: 'https://www.example.co.uk/vrf/', issues: [{ label: 'Title too long' }] }],
    pipeline: [{ id: 'i1', keyword: 'vrf installation london', status: 'idea' }],
  };
  const rows = rankingDiagnosis(input);

  it('keeps only searches worth winning, with reasons', () => {
    expect(rows.map((r) => r.keyword)).toEqual(['commercial air conditioning maintenance', 'vrf installation london']);
  });

  it('explains a missing page, the rival and the authority gap', () => {
    const r = rows[0];
    expect(r.ourPosition).toBeNull();
    expect(r.competitors[0]).toMatchObject({ domain: 'rival.co.uk', position: 2 });
    expect(r.reasons.map((x) => x.kind)).toEqual(['no-page', 'authority', 'hard']);
    expect(r.fix).toMatch(/Write a page/);
  });

  it('flags low click-through, slipping and page problems on a page we have', () => {
    const r = rows[1];
    expect(r.reasons.map((x) => x.kind)).toEqual(['low-ctr', 'slipping', 'page-issues']);
    expect(r.pipeline).toMatchObject({ id: 'i1' });
    expect(r.fix).toMatch(/title and meta description/);
  });

  it('knows typical click-through on page one only', () => {
    expect(expectedCtr(1)).toBeGreaterThan(expectedCtr(5));
    expect(expectedCtr(14)).toBeNull();
  });
});

describe('working and trending', () => {
  it('picks rising queries, movers, pages and posts', () => {
    const w = whatsWorking({
      queries: [{ key: 'a', clicks: 10, clicksChange: 5, position: 4, positionChange: 1 }, { key: 'b', clicks: 3, clicksChange: -2, position: 9, positionChange: -1 }],
      ranked: [{ keyword: 'k1', change: 'up', position: 5, previousPosition: 9, traffic: 30 }, { keyword: 'k2', change: 'down', position: 12 }],
      pages: [{ page: '/b', clicks: 2 }, { page: '/a', clicks: 20 }],
      posts: [
        { id: 'p1', service: 'linkedin', text: 'Low', metrics: [{ type: 'impressions', value: 100 }, { type: 'engagementRate', value: 1 }] },
        { id: 'p2', service: 'linkedin', text: 'High', metrics: [{ type: 'impressions', value: 1000 }, { type: 'engagementRate', value: 6 }] },
      ],
    });
    expect(w.risingQueries.map((q) => q.query)).toEqual(['a']);
    expect(w.movingUp.map((r) => r.keyword)).toEqual(['k1']);
    expect(w.topPages[0].page).toBe('/a');
    expect(w.topPosts[0].id).toBe('p2');
  });

  it('finds rising niche searches, new searches and competitor movers', () => {
    const t = whatsTrending({
      demand: [{ keyword: 'heat pump installation', volume: 900, trend: 60 }, { keyword: 'flat', volume: 900, trend: 2 }],
      queries: [{ key: 'heat pump grants offices', impressions: 80, position: 18, prevClicks: 0, prevPosition: null }, { key: 'pizza', impressions: 80, prevPosition: null }],
      overviewHistory: [
        { createdAt: '2026-09-01', data: [{ domain: 'us.co.uk', you: true, traffic: 100 }, { domain: 'rival.co.uk', traffic: 1000 }] },
        { createdAt: '2026-10-01', data: [{ domain: 'us.co.uk', you: true, traffic: 120 }, { domain: 'rival.co.uk', traffic: 1500 }] },
      ],
      ai: { questions: [{ question: 'Who installs VRF in Kent?', volume: 10, brands: ['Rival'] }] },
      seeds: ['commercial heat pump installation'],
    });
    expect(t.risingSearches.map((d) => d.keyword)).toEqual(['heat pump installation']);
    expect(t.newSearches.map((q) => q.query)).toEqual(['heat pump grants offices']);
    expect(t.competitorMovers).toEqual([{ domain: 'rival.co.uk', change: 0.5, traffic: 1500 }]);
    expect(t.aiQuestions[0].brands).toEqual(['Rival']);
  });

  it('builds the competitor table with share of search and trend', () => {
    const history = [
      { createdAt: '1', data: [{ domain: 'us.co.uk', you: true, traffic: 100, top10: 5 }, { domain: 'rival.co.uk', traffic: 300 }] },
      { createdAt: '2', data: [{ domain: 'us.co.uk', you: true, traffic: 200, top10: 8 }, { domain: 'rival.co.uk', traffic: 600 }] },
    ];
    expect(competitorMoves(history)[0].change).toBe(1);
    const table = competitorTable({ overviewHistory: history, backlinks: [{ domain: 'rival.co.uk', referringDomains: 50 }], leaders: [], domain: 'us.co.uk' });
    expect(table.map((r) => [r.domain, r.share])).toEqual([['rival.co.uk', 0.75], ['us.co.uk', 0.25]]);
    expect(table[1]).toMatchObject({ you: true, trend: [100, 200], top10: 8 });
    expect(table[0].referringDomains).toBe(50);
  });
});
