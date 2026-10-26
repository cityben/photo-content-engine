/**
 * UK time helpers used for scheduling
 */

import { dateToZonedInput, nextQueueSlot, zonedToDate } from '../src/lib/time';

describe('zonedToDate', () => {
  it('handles British Summer Time and GMT', () => {
    expect(zonedToDate('2026-07-01T09:30', 'Europe/London').toISOString()).toBe('2026-07-01T08:30:00.000Z');
    expect(zonedToDate('2026-12-01T09:30', 'Europe/London').toISOString()).toBe('2026-12-01T09:30:00.000Z');
  });

  it('round-trips with dateToZonedInput', () => {
    expect(dateToZonedInput(zonedToDate('2026-10-30T17:45', 'Europe/London'), 'Europe/London')).toBe('2026-10-30T17:45');
  });
});

describe('nextQueueSlot', () => {
  it('skips weekends and taken slots', () => {
    const fridayEvening = new Date('2026-10-30T18:00:00Z'); // after the last Friday slot
    const slot = nextQueueSlot(fridayEvening, [], 'Europe/London');
    expect(slot.toISOString()).toBe('2026-11-02T08:30:00.000Z'); // Monday 08:30 GMT
    const next = nextQueueSlot(fridayEvening, [slot.toISOString()], 'Europe/London');
    expect(next.toISOString()).toBe('2026-11-02T12:30:00.000Z');
  });
});
