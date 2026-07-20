#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadMarketingProgram, validateMarketingProgram } from '../lib/marketing-program.mjs';

const fleetRoot = resolve(import.meta.dirname, '../..');
const programPath = resolve(import.meta.dirname, '../config/marketing-program.json');
const catalog = JSON.parse(readFileSync(resolve(fleetRoot, 'saas-maker/foundry.projects.json'), 'utf8'));
const registry = loadMarketingProgram(programPath);
validateMarketingProgram(registry, { activeSlugs: [...Object.keys(catalog), 'fleet-ops', 'wifi-watch'] });
console.log(`marketing program v${registry.version}: ${registry.projects.length} projects, ${registry.focusSet.length} focus`);
