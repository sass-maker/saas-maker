#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveFoundryProjectsPath } from '../lib/foundry-paths.mjs';
import { loadMarketingProgram, validateMarketingProgram } from '../lib/marketing-program.mjs';

const programPath = resolve(import.meta.dirname, '../config/marketing-program.json');
const catalog = JSON.parse(readFileSync(resolveFoundryProjectsPath(), 'utf8'));
const registry = loadMarketingProgram(programPath);
validateMarketingProgram(registry, { catalogSlugs: [...Object.keys(catalog), 'fleet-ops', 'wifi-watch'] });
console.log(`marketing program v${registry.version}: ${registry.projects.length} projects, ${registry.focusSet.length} focus`);
