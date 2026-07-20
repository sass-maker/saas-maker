import { describe, expect, it } from 'vitest';
import { createSpeedFixture } from './speed-data';

describe('speed fixture snapshot', () => {
  it('includes all required workspace sections and sanitized fields', () => {
    const snap = createSpeedFixture(new Date('2026-07-20T12:00:00.000Z'));
    expect(snap.schemaVersion).toBe('speed.v1');
    expect(snap.surfaces.length).toBeGreaterThan(0);
    expect(snap.routes.length).toBeGreaterThan(0);
    expect(snap.recentRequests.length).toBeGreaterThan(0);
    expect(snap.routeDetails.length).toBeGreaterThan(0);
    expect(snap.webDiagnostics.length).toBeGreaterThan(0);

    for (const span of snap.recentRequests) {
      expect(span.routeTemplate.includes('?')).toBe(false);
      for (const op of span.operations) {
        expect(op.label.includes('SELECT')).toBe(false);
        expect(op.fingerprint.startsWith('fp_')).toBe(true);
      }
    }

    const states = new Set(snap.surfaces.map((s) => s.state));
    expect(states.has('fresh')).toBe(true);
    expect(states.has('unmeasured')).toBe(true);
    expect(states.has('failing')).toBe(true);
  });
});
