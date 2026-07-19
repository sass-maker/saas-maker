#!/usr/bin/env node
import {
  assertValidCatalog,
  GENERATED_ROOT,
  readCatalog,
  writeCompatibilityViews,
} from './foundry-catalog-lib.mjs';

try {
  const catalog = assertValidCatalog(await readCatalog());
  const files = await writeCompatibilityViews(catalog);
  console.log(`Generated ${files.length} Foundry catalog views in ${GENERATED_ROOT}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
