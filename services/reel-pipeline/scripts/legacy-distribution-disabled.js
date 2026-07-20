#!/usr/bin/env node
import { legacyDistributionFailure } from '../src/legacy-distribution-guard.js';

const failure = legacyDistributionFailure(process.argv[2]);
console.error(JSON.stringify(failure));
process.exitCode = 78;
