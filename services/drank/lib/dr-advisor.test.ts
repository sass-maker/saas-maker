import { describe, expect, it } from 'vitest';

import { drAdvisorMeasurementKey, parseDrAdvisorAdvice, parseDrAdvisorRequest } from './dr-advisor';

const request = {
  domain: 'example.com',
  currentDr: 42.4,
  trend: { direction: 'up' as const, delta: 2.2, periodDays: 7 },
};

describe('DR Advisor contracts', () => {
  it('normalizes and bounds a valid request', () => {
    expect(parseDrAdvisorRequest({ ...request, domain: 'WWW.Example.com' })).toEqual(request);
  });

  it('rejects invalid domains and DR values', () => {
    expect(() => parseDrAdvisorRequest({ ...request, domain: 'localhost' })).toThrow();
    expect(() => parseDrAdvisorRequest({ ...request, currentDr: 101 })).toThrow();
  });

  it('parses a fenced structured response', () => {
    const advice = parseDrAdvisorAdvice(
      '```json\n' +
        JSON.stringify({
          schemaVersion: 1,
          why: 'The observed DR and upward trend suggest authority is improving, though the cause is unknown.',
          evidenceLimit:
            'Only DR and its trend were observed; no backlinks or site content were inspected.',
          actions: [
            {
              priority: 1,
              title: 'Publish link-worthy research',
              reason:
                'Original data gives relevant publishers a concrete reason to reference the site.',
            },
            {
              priority: 2,
              title: 'Reclaim relevant mentions',
              reason:
                'Turning legitimate unlinked mentions into citations can strengthen authority.',
            },
            {
              priority: 3,
              title: 'Audit weak link acquisition',
              reason: 'Prioritize relevant editorial links instead of chasing raw backlink volume.',
            },
          ],
        }) +
        '\n```'
    );
    expect(advice.actions).toHaveLength(3);
    expect(advice.why).toContain('upward trend');
  });

  it('rejects malformed or unprioritized output', () => {
    expect(() => parseDrAdvisorAdvice('{"schemaVersion":1}')).toThrow();
    expect(() =>
      parseDrAdvisorAdvice({
        schemaVersion: 1,
        why: 'A sufficiently long explanation of the observed measurement.',
        evidenceLimit: 'No backlink evidence was available.',
        actions: [
          { priority: 2, title: 'Wrong order', reason: 'This item is deliberately misnumbered.' },
          { priority: 1, title: 'Wrong order', reason: 'This item is deliberately misnumbered.' },
          { priority: 3, title: 'Wrong order', reason: 'This item is deliberately misnumbered.' },
        ],
      })
    ).toThrow();
  });

  it('creates stable measurement keys that change across material buckets', () => {
    expect(drAdvisorMeasurementKey(request)).toBe(drAdvisorMeasurementKey({ ...request }));
    expect(drAdvisorMeasurementKey(request)).not.toBe(
      drAdvisorMeasurementKey({ ...request, currentDr: 50 })
    );
  });
});
