import { describe, expect, it } from 'vitest';
import { getFleetToday } from '../../apps/cockpit/src/lib/fleet-today';

// Asia/Kolkata is UTC+5:30.  IST midnight = 18:30 UTC the day before.
// Entries committed late UTC night (e.g. 23:30 UTC) belong to the IST
// next morning — a bare date(created_at) comparison would hide them.

describe('getFleetToday — Asia/Kolkata local-day bucketing', () => {
  it('returns the IST date for a timestamp well within the IST day', () => {
    // 2026-05-26T10:00:00Z = 2026-05-26T15:30:00+05:30
    const ts = new Date('2026-05-26T10:00:00Z').getTime();
    expect(getFleetToday(ts)).toBe('2026-05-26');
  });

  it('rolls to IST next day exactly at the IST midnight boundary (18:30 UTC)', () => {
    // 2026-05-25T18:29:59Z = 2026-05-25T23:59:59+05:30 — still IST day 25
    const before = new Date('2026-05-25T18:29:59Z').getTime();
    expect(getFleetToday(before)).toBe('2026-05-25');

    // 2026-05-25T18:30:00Z = 2026-05-26T00:00:00+05:30 — IST day 26
    const after = new Date('2026-05-25T18:30:00Z').getTime();
    expect(getFleetToday(after)).toBe('2026-05-26');
  });

  it('late-UTC entry (23:30 UTC) resolves to IST next day, not UTC day', () => {
    // 2026-05-25T23:30:00Z = 2026-05-26T05:00:00+05:30 → IST date 2026-05-26
    // A UTC-only comparison would return 2026-05-25 and hide this entry.
    const lateUtc = new Date('2026-05-25T23:30:00Z').getTime();
    expect(getFleetToday(lateUtc)).toBe('2026-05-26');
  });

  it('uses real Date.now() when no argument is given (smoke)', () => {
    const result = getFleetToday();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
