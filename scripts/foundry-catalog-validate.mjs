#!/usr/bin/env node
import { assertValidCatalog, CATALOG_PATH, readCatalog } from './foundry-catalog-lib.mjs';

try {
  const catalog = await readCatalog();
  assertValidCatalog(catalog);
  console.log(`Foundry catalog valid: ${CATALOG_PATH}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
