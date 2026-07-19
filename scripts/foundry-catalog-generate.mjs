#!/usr/bin/env node
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertValidCatalog,
  CATALOG_ROOT,
  GENERATED_ROOT,
  readCatalog,
  writeCompatibilityViews,
} from './foundry-catalog-lib.mjs';

try {
  const catalog = assertValidCatalog(await readCatalog());
  const files = await writeCompatibilityViews(catalog);
  const repositoryRoot = path.dirname(CATALOG_ROOT);
  for (const [generated, mirror] of [
    ['foundry.projects.json', 'foundry.projects.json'],
    ['ops-config-projects.json', 'ops/config/projects.json'],
    ['automation-registry.json', 'ops/config/automation-registry.json'],
  ]) {
    await copyFile(path.join(GENERATED_ROOT, generated), path.join(repositoryRoot, mirror));
  }
  console.log(`Generated ${files.length} Foundry catalog views in ${GENERATED_ROOT}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
