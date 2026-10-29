#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildPublicProducts } from './public-products.mjs';
import { catalogPaths } from './catalog-paths.mjs';
import { validateFooterArt } from '../packages/fleet-footer/src/artwork.mjs';
import { validatePublicCollections } from './project-collections.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fleetCatalog = path.resolve(
  process.env.FLEET_PUBLIC_PRODUCTS_PATH ?? catalogPaths(repoRoot).source
);
const destination = path.join(repoRoot, 'catalog/generated/public.json');

const PUBLIC_FIELDS = new Set([
  'id',
  'name',
  'description',
  'url',
  'tier',
  'category',
  'priority',
  'spotlight',
  'lifecycle',
  'shareable',
  'maturity',
  'repositoryUrl',
  'changelogUrl',
  'roadmapUrl',
  'pillarId',
  'purposeContract',
  'footerArt',
]);
const REQUIRED_FIELDS = ['id', 'name', 'description', 'url'];
const DIRECTORY_FIELDS = new Set([
  'category',
  'shareable',
  'id',
  'name',
  'description',
  'makerNote',
  'logoUrl',
  'purposeContract',
  'footerArt',
  'kind',
  'form',
  'platforms',
  'technologies',
  'group',
  'lifecycle',
  'deployed',
  'deploymentProviders',
  'domains',
  'url',
  'firstCommitAt',
  'latestCommitAt',
  'roster',
  'availability',
  'publicUrl',
  'publicUrlLabel',
  'repositoryUrl',
  'changelogUrl',
  'roadmapUrl',
]);
const LEGACY_DIRECTORY_FIELDS = new Set([
  'category',
  'shareable',
  'id',
  'name',
  'description',
  'makerNote',
  'logoUrl',
  'purposeContract',
  'footerArt',
  'kind',
  'form',
  'platforms',
  'technologies',
  'group',
  'lifecycle',
  'deployed',
  'deploymentProviders',
  'domains',
  'url',
  'repositoryUrl',
  'changelogUrl',
  'roadmapUrl',
  'firstCommitAt',
  'latestCommitAt',
]);
const ARCHIVED_DIRECTORY_FIELDS = new Set([
  'id',
  'name',
  'description',
  'form',
  'platforms',
  'technologies',
  'roster',
  'availability',
  'profileUrl',
]);
const FORBIDDEN_KEYS =
  /(?:secret|token|password|credential|private|owner|cfProject|notes|dependencies|evidence|assessment|contracts)/i;
const CREDENTIAL_VALUE =
  /(?:bearer\s+[a-z0-9._-]+|(?:api|access|secret)[_-]?key\s*[:=]|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;

function assertNoPrivateData(value, trail = 'projection') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoPrivateData(entry, `${trail}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) throw new Error(`${trail}.${key}: forbidden private field`);
      assertNoPrivateData(entry, `${trail}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && CREDENTIAL_VALUE.test(value)) {
    throw new Error(`${trail}: credential-shaped value`);
  }
}

export function validateProjection(parsed, sourcePath) {
  if (![1, 2, 3, 4, 5, 6].includes(parsed.schemaVersion) || !Array.isArray(parsed.products)) {
    throw new Error(`Unsupported Fleet public projection: ${sourcePath}`);
  }

  const ids = new Set();
  for (const product of parsed.products) {
    if (!product || typeof product !== 'object' || Array.isArray(product)) {
      throw new Error(`${sourcePath}: every product must be an object`);
    }
    for (const key of Object.keys(product)) {
      if (!PUBLIC_FIELDS.has(key))
        throw new Error(`${product.id ?? 'unknown'}: unsupported public field ${key}`);
    }
    for (const key of REQUIRED_FIELDS) {
      if (!product[key]) throw new Error(`${product.id ?? 'unknown'}: missing ${key}`);
    }
    if (ids.has(product.id)) throw new Error(`public product ids must be unique: ${product.id}`);
    ids.add(product.id);
    validateFooterArt(product.footerArt, product.id);
  }
  if (parsed.schemaVersion >= 3 && parsed.schemaVersion < 6) {
    if (!Array.isArray(parsed.directory) || parsed.directory.length === 0) {
      throw new Error(`${sourcePath}: complete public directory is required`);
    }
    const directoryIds = new Set();
    for (const project of parsed.directory) {
      for (const key of Object.keys(project)) {
        if (!LEGACY_DIRECTORY_FIELDS.has(key))
          throw new Error(`${project.id ?? 'unknown'}: unsupported directory field ${key}`);
      }
      for (const key of ['id', 'name', 'description', 'makerNote', 'form', 'group', 'lifecycle']) {
        if (!project[key]) throw new Error(`${project.id ?? 'unknown'}: missing directory ${key}`);
      }
      if (directoryIds.has(project.id)) {
        throw new Error(`public directory ids must be unique: ${project.id}`);
      }
      directoryIds.add(project.id);
      validateFooterArt(project.footerArt, project.id);
      if (project.id !== 'ios-landings')
        validatePurposeContract(project.purposeContract, project.id);
    }
  }
  if (parsed.schemaVersion >= 6) {
    if (!Array.isArray(parsed.directory) || parsed.directory.length === 0) {
      throw new Error(`${sourcePath}: complete public directory is required`);
    }
    const directoryIds = new Set();
    for (const project of parsed.directory) {
      for (const key of Object.keys(project)) {
        if (!DIRECTORY_FIELDS.has(key)) {
          throw new Error(`${project.id ?? 'unknown'}: unsupported directory field ${key}`);
        }
      }
      for (const key of [
        'id',
        'name',
        'description',
        'makerNote',
        'form',
        'group',
        'roster',
        'availability',
      ]) {
        if (!project[key]) throw new Error(`${project.id ?? 'unknown'}: missing directory ${key}`);
      }
      if (project.roster !== 'current') {
        throw new Error(`${project.id}: current directory entry has the wrong roster`);
      }
      if (
        ![
          'public-link',
          'no-public-link',
          'not-publicly-available',
          'internal-private',
          'preview-not-qualified',
          'unreleased-prototype',
        ].includes(project.availability)
      ) {
        throw new Error(`${project.id}: invalid current profile availability`);
      }
      if (
        ['not-publicly-available', 'internal-private'].includes(project.availability) &&
        (project.publicUrl || project.repositoryUrl || project.url || project.domains)
      ) {
        throw new Error(
          `${project.id}: unavailable current profile cannot publish an external link`
        );
      }
      if (project.availability === 'public-link' && !project.publicUrl) {
        throw new Error(`${project.id}: public website availability requires a public destination`);
      }
      if (project.publicUrl && !/^https:\/\//.test(project.publicUrl)) {
        throw new Error(`${project.id}: public destination must use HTTPS`);
      }
      if (project.publicUrl && typeof project.publicUrlLabel !== 'string') {
        throw new Error(`${project.id}: public destination needs an accurate label`);
      }
      if (
        project.availability === 'unreleased-prototype' &&
        project.publicUrl &&
        project.publicUrlLabel !== 'Landing page'
      ) {
        throw new Error(
          `${project.id}: unreleased prototype destination must be identified as a landing page`
        );
      }
      if (
        project.availability === 'preview-not-qualified' &&
        project.publicUrl &&
        project.publicUrlLabel !== 'Preview site'
      ) {
        throw new Error(`${project.id}: preview destination must not imply a released product`);
      }
      validateProfilePurposeContract(project.purposeContract, project.id);
      if (directoryIds.has(project.id)) {
        throw new Error(`public directory ids must be unique: ${project.id}`);
      }
      directoryIds.add(project.id);
    }
    if (!Array.isArray(parsed.archivedDirectory) || parsed.archivedDirectory.length === 0) {
      throw new Error(`${sourcePath}: archived identity directory is required`);
    }
    const archivedIds = new Set();
    for (const project of parsed.archivedDirectory) {
      for (const key of Object.keys(project)) {
        if (!ARCHIVED_DIRECTORY_FIELDS.has(key)) {
          throw new Error(
            `${project.id ?? 'unknown'}: unsupported archived directory field ${key}`
          );
        }
      }
      for (const key of [
        'id',
        'name',
        'description',
        'form',
        'roster',
        'availability',
        'profileUrl',
      ]) {
        if (!project[key]) throw new Error(`${project.id ?? 'unknown'}: missing archived ${key}`);
      }
      if (
        project.roster !== 'archived' ||
        project.availability !== 'archived' ||
        project.profileUrl !== `https://sassmaker.com/p/${project.id}`
      ) {
        throw new Error(`${project.id}: archived profile must remain explicitly archived`);
      }
      if (directoryIds.has(project.id) || archivedIds.has(project.id)) {
        throw new Error(`${project.id}: current/archive identities must be unique and disjoint`);
      }
      archivedIds.add(project.id);
    }
    if (
      [...directoryIds, ...archivedIds].length !== new Set([...directoryIds, ...archivedIds]).size
    ) {
      throw new Error(`${sourcePath}: current and archived identities must be unique`);
    }
  }
  for (const project of parsed.pastProjects ?? []) {
    validateFooterArt(project.footerArt, project.id);
  }
  if (parsed.collections !== undefined)
    validatePublicCollections(parsed.collections, parsed.directory ?? []);
  assertNoPrivateData(parsed);
}

function validatePurposeContract(contract, projectId) {
  const fields = ['purpose', 'audience', 'outcome', 'mechanism', 'proof', 'nextAction'];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new Error(`${projectId}: missing purpose contract`);
  }
  const unsupported = Object.keys(contract).filter((key) => !fields.includes(key));
  if (unsupported.length > 0) {
    throw new Error(`${projectId}: unsupported purpose contract field ${unsupported[0]}`);
  }
  for (const field of fields) {
    if (typeof contract[field] !== 'string' || contract[field].trim().length < 8) {
      throw new Error(`${projectId}: missing purpose contract ${field}`);
    }
  }
}

function validateProfilePurposeContract(contract, projectId) {
  const fields = ['purpose', 'audience', 'outcome', 'mechanism', 'proof', 'nextAction'];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw new Error(`${projectId}: missing profile purpose contract`);
  }
  const unsupported = Object.keys(contract).filter((key) => !fields.includes(key));
  if (unsupported.length > 0) {
    throw new Error(`${projectId}: unsupported profile contract field ${unsupported[0]}`);
  }
  for (const field of fields.slice(0, 4)) {
    if (typeof contract[field] !== 'string' || contract[field].trim().length < 8) {
      throw new Error(`${projectId}: missing profile contract ${field}`);
    }
  }
  for (const field of fields.slice(4)) {
    if (
      contract[field] !== undefined &&
      (typeof contract[field] !== 'string' || !contract[field].trim())
    ) {
      throw new Error(`${projectId}: invalid optional profile contract ${field}`);
    }
  }
}

async function main() {
  if (process.argv.includes('--validate')) {
    const checkedIn = await readFile(destination, 'utf8');
    const parsed = JSON.parse(checkedIn);
    validateProjection(parsed, destination);
    console.log(
      `SaaS Maker checked-in public catalog is valid (${parsed.directory?.length ?? parsed.products.length} identities)`
    );
    return;
  }

  const catalog = JSON.parse(await readFile(fleetCatalog, 'utf8'));
  const projection = buildPublicProducts(catalog);
  validateProjection(projection, fleetCatalog);
  const rendered = `${JSON.stringify(projection, null, 2)}\n`;

  if (process.argv.includes('--check')) {
    const current = await readFile(destination, 'utf8').catch(() => '');
    if (current !== rendered) {
      console.error('SaaS Maker public catalog is stale; run pnpm catalog:sync-public');
      process.exitCode = 1;
    } else {
      console.log(
        `SaaS Maker public catalog matches Site Health catalog/projects.json (${projection.directory?.length ?? projection.products.length} identities)`
      );
    }
  } else {
    await writeFile(destination, rendered);
    console.log(
      `Synced ${projection.directory?.length ?? projection.products.length} public identities from Site Health catalog/projects.json`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
