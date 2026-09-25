import { describe, expect, it } from 'vitest';
import { formatDirectoryDate } from '../../apps/showcase/src/data/format-directory-date';

describe('directory dates', () => {
  it('uses a readable, unambiguous full-month date without shifting days', () => {
    expect(formatDirectoryDate('2026-09-23')).toBe('23 September 2026');
    expect(formatDirectoryDate('2025-11-30')).toBe('30 November 2025');
  });
});
