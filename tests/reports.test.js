/**
 * Monthly report: month ranges and CSV safety
 */

jest.mock('ai', () => ({
  gateway: { getAvailableModels: jest.fn(async () => ({ models: [] })) },
  generateText: jest.fn(),
  Output: { object: jest.fn((o) => o) },
}));

import { csvFor, isMonth, monthRange, recentMonths, toCsv } from '../src/lib/reports';

describe('monthRange', () => {
  it('covers a whole past month', () => {
    const r = monthRange('2026-02', new Date('2026-10-26T12:00:00Z'));
    expect(r).toMatchObject({ from: '2026-02-01', to: '2026-02-28', partial: false, label: 'February 2026' });
  });

  it('stops the current month at today', () => {
    const r = monthRange('2026-10', new Date('2026-10-26T12:00:00Z'));
    expect(r).toMatchObject({ from: '2026-10-01', to: '2026-10-26', partial: true });
  });

  it('validates and lists months', () => {
    expect(isMonth('2026-10')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(recentMonths(3, new Date('2026-01-15T00:00:00Z'))).toEqual(['2026-01', '2025-12', '2025-11']);
  });
});

describe('CSV', () => {
  it('quotes commas, quotes and newlines, and neutralises formulas', () => {
    const csv = toCsv([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: 'x, "y"', b: '=HYPERLINK("evil")' }, { a: 'line\nbreak', b: null }]);
    expect(csv).toBe('A,B\r\n"x, ""y""","\'=HYPERLINK(""evil"")"\r\n"line\nbreak",\r\n');
  });

  it('exports posts and refuses unknown kinds', () => {
    const data = { range: { label: 'October 2026' }, social: { posts: [{ sentAt: '2026-10-02', service: 'linkedin', impressions: 120, reactions: 4, comments: 1, text: 'VRF done.' }] }, work: { jobsCreated: [], caseStudiesSent: [], ideasPublished: [] } };
    expect(csvFor('posts', data).split('\r\n')[1]).toBe('2026-10-02,linkedin,120,4,1,VRF done.');
    expect(() => csvFor('nope', data)).toThrow('Unknown export');
  });
});
