import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PROD_API_URL = 'https://api.sassmaker.com';
const BYPASS_FLAG = 'LOCAL_AUTH_BYPASS=true';

const rootPackageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf8')
) as { scripts?: Record<string, string> };

describe('root package.json scripts policy', () => {
  it('never pairs LOCAL_AUTH_BYPASS=true with the production API URL', () => {
    const offenders = Object.entries(rootPackageJson.scripts ?? {}).filter(
      ([, command]) => command.includes(BYPASS_FLAG) && command.includes(PROD_API_URL)
    );

    expect(offenders).toEqual([]);
  });
});
