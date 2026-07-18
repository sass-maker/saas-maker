#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const FLEET_ROOT = resolve(import.meta.dirname, '..', '..');
const CONTRACT_PATH = resolve(FLEET_ROOT, 'fleet-ops/config/spotlight-products.json');
const SYNC_CONFIG_PATH = resolve(FLEET_ROOT, 'fleet-ops/config/spotlight-sync.json');

function parseArgs(argv) {
  const args = { mode: 'check', strict: false, workspace: FLEET_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') args.mode = 'write';
    else if (arg === '--check') args.mode = 'check';
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--workspace') args.workspace = resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function resolveCheckout(workspace, checkoutPath) {
  const inWorkspace = resolve(workspace, checkoutPath);
  if (existsSync(inWorkspace)) return inWorkspace;
  const sibling = resolve(workspace, '..', checkoutPath);
  if (existsSync(sibling)) return sibling;
  return inWorkspace;
}

function expectedFoundryKeys(contract) {
  return Object.fromEntries(contract.products.map((product) => [product.id, {
    codevetter: 'CodeVetter',
    posttrainllm: 'posttrainllm',
    heypace: 'pace',
    hisignal: 'high-signal',
    'saas-maker': 'saas-maker',
  }[product.id]]));
}

function portfolioSource(contract) {
  return `export type SpotlightProduct = {\n  id: string;\n  label: string;\n  name: string;\n  url: string;\n  organizationUrl: string;\n  repositoryUrl: string;\n  description: string;\n};\n\n/** Synchronized with fleet-ops/config/spotlight-products.json. */\nexport const spotlightProducts: readonly SpotlightProduct[] = [\n${contract.products.map((product) => `  {\n    id: '${product.id}',\n    label: '${product.label}',\n    name: '${product.name}',\n    url: '${product.url}',\n    organizationUrl: '${product.organizationUrl}',\n    repositoryUrl: '${product.repositoryUrl}',\n    description: '${product.description}',\n  },`).join('\n')}\n] as const;\n`;
}

async function checkProfileFile(profile, readmePath, contract, directoryUrl, errors, warnings, label = profile.id) {
  if (!existsSync(readmePath)) {
    warnings.push(`${label} profile mirror is unavailable at ${readmePath}`);
    return;
  }
  const source = await readFile(readmePath, 'utf8');
  if (!source.includes(directoryUrl)) {
    errors.push(`${label} profile is missing the directory URL ${directoryUrl}`);
  }
  for (const productId of profile.requiredProductIds) {
    const product = contract.products.find((entry) => entry.id === productId);
    if (!source.includes(product.url)) errors.push(`${label} profile is missing ${productId} URL ${product.url}`);
  }
}

async function profileChecks(contract, config, workspace, strict, errors, warnings) {
  for (const profile of config.targets.profiles) {
    const readmePath = resolve(resolveCheckout(workspace, profile.checkoutPath), profile.file);
    if (!existsSync(readmePath)) {
      if (strict) errors.push(`${profile.id} profile is unavailable at ${readmePath}`);
    } else {
      await checkProfileFile(profile, readmePath, contract, config.directoryUrl, errors, warnings, profile.id);
    }
    if (profile.localMirror) {
      const mirrorPath = resolve(FLEET_ROOT, profile.localMirror);
      if (existsSync(mirrorPath)) {
        await checkProfileFile(profile, mirrorPath, contract, config.directoryUrl, errors, warnings, `${profile.id} local mirror`);
      } else {
        warnings.push(`${profile.id} local mirror is unavailable at ${mirrorPath}`);
      }
    }
  }
}

async function validate(contract, config, options) {
  const errors = [];
  const warnings = [];
  const expected = contract.products;
  if (contract.version !== 1) errors.push(`unsupported contract version ${contract.version}`);
  if (expected.length !== 5) errors.push(`contract must contain 5 products, found ${expected.length}`);
  if (new Set(expected.map((product) => product.id)).size !== expected.length) errors.push('contract contains duplicate IDs');
  for (const product of expected) {
    for (const field of ['id', 'showcaseId', 'label', 'name', 'url', 'organizationUrl', 'repositoryUrl', 'description']) {
      if (!product[field]) errors.push(`${product.id || '<unknown>'} is missing ${field}`);
    }
  }

  const portfolioPath = resolve(resolveCheckout(options.workspace, config.targets.portfolio.checkoutPath), config.targets.portfolio.file);
  if (!existsSync(portfolioPath)) errors.push(`portfolio target is missing at ${portfolioPath}`);
  else {
    const source = await readFile(portfolioPath, 'utf8');
    for (const product of expected) {
      if (!source.includes(`id: '${product.id}'`)) errors.push(`portfolio is missing ${product.id}`);
      if (!source.includes(product.url)) errors.push(`portfolio has the wrong URL for ${product.id}`);
    }
  }

  const foundryPath = resolve(resolveCheckout(options.workspace, config.targets.saasMakerFoundry.checkoutPath), config.targets.saasMakerFoundry.file);
  const productSitesPath = resolve(resolveCheckout(options.workspace, config.targets.saasMakerShowcase.checkoutPath), config.targets.saasMakerShowcase.file);
  if (!existsSync(foundryPath)) errors.push(`SaaS Maker foundry target is missing at ${foundryPath}`);
  else {
    const foundry = await readJson(foundryPath);
    const mapping = expectedFoundryKeys(contract);
    const actual = Object.entries(foundry).filter(([, project]) => project.spotlight === true).map(([id]) => id).sort();
    const expectedKeys = expected.map((product) => mapping[product.id]).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expectedKeys)) errors.push(`foundry spotlight drift: expected ${expectedKeys.join(', ')}, found ${actual.join(', ')}`);
  }
  if (!existsSync(productSitesPath)) errors.push(`SaaS Maker showcase target is missing at ${productSitesPath}`);
  else {
    const productSites = await readJson(productSitesPath);
    const actual = productSites.products.filter((product) => product.spotlight === true).map((product) => `${product.id}:${product.url}`).sort();
    const expectedSites = expected.map((product) => `${product.showcaseId}:${product.url}`).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expectedSites)) errors.push(`showcase spotlight drift: expected ${expectedSites.join(', ')}, found ${actual.join(', ')}`);
  }

  await profileChecks(contract, config, options.workspace, options.strict, errors, warnings);
  return { errors, warnings };
}

async function writeConsumers(contract, config, workspace) {
  const portfolioPath = resolve(resolveCheckout(workspace, config.targets.portfolio.checkoutPath), config.targets.portfolio.file);
  const foundryPath = resolve(resolveCheckout(workspace, config.targets.saasMakerFoundry.checkoutPath), config.targets.saasMakerFoundry.file);
  const productSitesPath = resolve(resolveCheckout(workspace, config.targets.saasMakerShowcase.checkoutPath), config.targets.saasMakerShowcase.file);
  const mapping = expectedFoundryKeys(contract);
  const spotlightFoundryKeys = new Set(contract.products.map((product) => mapping[product.id]));

  await writeFile(portfolioPath, portfolioSource(contract));
  const foundry = await readJson(foundryPath);
  for (const [id, project] of Object.entries(foundry)) {
    project.spotlight = spotlightFoundryKeys.has(id);
    if (!project.spotlight) delete project.spotlight;
  }
  await writeFile(foundryPath, `${JSON.stringify(foundry, null, 2)}\n`);

  const productSites = await readJson(productSitesPath);
  const showcaseIds = new Set(contract.products.map((product) => product.showcaseId));
  for (const product of productSites.products) {
    if (showcaseIds.has(product.id)) product.spotlight = true;
    else delete product.spotlight;
  }
  await writeFile(productSitesPath, `${JSON.stringify(productSites, null, 2)}\n`);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const [contract, config] = await Promise.all([readJson(CONTRACT_PATH), readJson(SYNC_CONFIG_PATH)]);
  if (options.mode === 'write') {
    await writeConsumers(contract, config, options.workspace);
    console.log('Spotlight consumers regenerated.');
  }
  const result = await validate(contract, config, options);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  if (result.errors.length) {
    console.error('Fleet spotlight sync FAILED');
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`Fleet spotlight sync OK (${contract.products.length} products)`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main());
