import { describe, expect, it } from 'vitest';
import {
  catalogCsv,
  compareKnown,
  recordedDate,
} from '../../apps/showcase/src/lib/catalog-controls';

describe('catalog sorting and export', () => {
  it('keeps missing values last in both directions without hiding a reported zero', () => {
    const values = [null, 50, 0, 90, Number.NaN];
    expect(values.toSorted((a, b) => compareKnown(a, b, 'asc'))).toEqual([
      0,
      50,
      90,
      null,
      Number.NaN,
    ]);
    expect(values.toSorted((a, b) => compareKnown(a, b, 'desc'))).toEqual([
      90,
      50,
      0,
      null,
      Number.NaN,
    ]);
  });

  it('sorts a recorded range by its first date and leaves rolling or unknown dates missing', () => {
    expect(recordedDate('2026-08-01→2026-08-08')).toBe('2026-08-01');
    expect(recordedDate('Rolling')).toBeNull();
    expect(recordedDate(undefined)).toBeNull();
  });

  it('exports quotes, commas and line breaks while keeping blanks distinct from zero', () => {
    expect(catalogCsv([['A, B', '"quoted"', 'line\nbreak', null, 0]])).toBe(
      '"A, B","""quoted""","line\nbreak","","0"'
    );
  });

  it('prevents imported strings from becoming spreadsheet formulas', () => {
    expect(catalogCsv([['=HYPERLINK("https://example.com")', ' +1', '@SUM(A1)', 'ordinary']])).toBe(
      '"\'=HYPERLINK(""https://example.com"")","\' +1","\'@SUM(A1)","ordinary"'
    );
  });
});
