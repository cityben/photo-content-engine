/**
 * Posting targets: daily/weekly/monthly/yearly progress and next actions
 */

import { computeTargets, periodsFor } from '../src/lib/targets';

const schedule = {
  linkedin: { days: [2, 3, 4], times: ['08:30', '12:30'], perDay: 1 }, // Tue Wed Thu
  instagram: { days: [1, 3, 5], times: ['12:30', '18:00'], perDay: 1 }, // Mon Wed Fri
};
const now = new Date('2026-10-28T10:00:00Z'); // Wednesday, 10:00 UK (GMT)
const post = (service, status, iso) => ({ service, status, [status === 'sent' ? 'sentAt' : 'dueAt']: iso });
const labels = { linkedin: 'LinkedIn', instagram: 'Instagram' };

describe('periods', () => {
  it('uses Monday-to-Sunday weeks and calendar months', () => {
    expect(periodsFor('2026-10-28')).toMatchObject({
      week: { from: '2026-10-26', to: '2026-11-01' },
      month: { from: '2026-10-01', to: '2026-10-31' },
      year: { from: '2026-01-01', to: '2026-12-31' },
    });
  });
});

describe('computeTargets', () => {
  const posts = [
    post('linkedin', 'sent', '2026-10-27T08:30:00Z'), // Tue met
    post('instagram', 'sent', '2026-10-26T12:30:00Z'), // Mon met
    post('instagram', 'scheduled', '2026-10-28T18:00:00Z'), // today booked
    post('linkedin', 'sent', '2026-10-22T08:30:00Z'), // last Thu
    post('linkedin', 'sent', '2026-10-21T08:30:00Z'), // last Wed
  ];
  const ready = [{ jobId: 'j1', jobTitle: 'VRF swap, Rochester', service: 'linkedin' }];
  const pending = [{ jobId: 'j2', jobTitle: 'EICR, Maidstone', service: 'linkedin' }];
  const r = computeTargets({ schedule, posts, ready, pending, ideas: [{ id: 'i1', title: 'Heat pump school' }], now, labels });
  const li = r.services.find((s) => s.service === 'linkedin');
  const ig = r.services.find((s) => s.service === 'instagram');

  it('counts targets, published and booked per period', () => {
    expect(li.periods.week).toMatchObject({ target: 3, sent: 1, booked: 0, status: 'behind', behind: 1 });
    expect(ig.periods.week).toMatchObject({ target: 3, sent: 1, booked: 1, status: 'on-track', behind: 0 });
    expect(ig.periods.today).toMatchObject({ target: 1, covered: 1, status: 'covered' });
    expect(li.periods.today.status).toBe('behind');
  });

  it('counts the streak of met posting days', () => {
    expect(li.streak).toBe(3); // Tue 27, Thu 22, Wed 21
  });

  it('says what to do: today first, with the approved post and a free slot', () => {
    const first = r.actions[0];
    expect(first).toMatchObject({ id: 'linkedin-today', severity: 'high', kind: 'schedule', when: '2026-10-28T12:30' });
    expect(first.item.jobTitle).toBe('VRF swap, Rochester');
    expect(first.title).toBe('LinkedIn: 1 post short today');
    const week = r.actions.find((a) => a.id === 'linkedin-week');
    expect(week).toMatchObject({ kind: 'approve', jobId: 'j2' }); // ready post already used for today
    expect(week.detail).toMatch(/Thu 29 Oct/);
  });

  it('warns when approved posts run out', () => {
    expect(li.runsOutOn).toBeTruthy();
    expect(r.actions.find((a) => a.id === 'linkedin-runway')).toBeTruthy();
  });

  it('a rest day has no target', () => {
    const sat = computeTargets({ schedule, posts: [], now: new Date('2026-10-31T10:00:00Z'), labels });
    expect(sat.services.find((s) => s.service === 'linkedin').periods.today).toMatchObject({ target: 0, status: 'rest' });
  });

  it('honours posts per day', () => {
    const two = computeTargets({ schedule: { linkedin: { ...schedule.linkedin, perDay: 2 } }, posts, now, labels });
    expect(two.services[0].periods.week.target).toBe(6);
    expect(two.actions[0].title).toBe('LinkedIn: 2 posts short today');
  });
});

describe('targets start date', () => {
  it("doesn't count posting days before targets were set", () => {
    const r = computeTargets({ schedule, posts: [], now, labels, since: '2026-10-26' });
    const li = r.services.find((s) => s.service === 'linkedin');
    // From Mon 26 Oct: Tue 27, Wed 28, Thu 29 are the LinkedIn days left in October.
    expect(li.periods.month).toMatchObject({ target: 3, dueToDate: 2, behind: 2 });
    expect(li.streak).toBe(0);
    expect(r.actions.find((a) => a.id === 'linkedin-today').detail).toMatch(/^Wednesday is a LinkedIn day/);
    expect(r.since).toBe('2026-10-26');
  });

  it('uses "an" before a vowel', () => {
    const r = computeTargets({ schedule: { instagram: schedule.instagram }, posts: [], now, labels });
    expect(r.actions[0].detail).toMatch(/is an Instagram day/);
  });
});
