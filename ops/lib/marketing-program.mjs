import { readFileSync } from 'node:fs';

const MODES = new Set(['focus', 'evergreen', 'infrastructure', 'private']);
const CHANNELS = new Set(['instagram_reels', 'youtube_shorts', 'tiktok']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function loadMarketingProgram(path) {
  return validateMarketingProgram(JSON.parse(readFileSync(path, 'utf8')));
}

export function validateMarketingProgram(input, options = {}) {
  if (input?.$schema !== 'fleet.marketing-program.v1' || !Number.isInteger(input.version) || input.version < 1) {
    throw new MarketingProgramError('registry schema and positive version are required');
  }
  if (!Array.isArray(input.projects) || input.projects.length === 0 || !Array.isArray(input.focusSet)) {
    throw new MarketingProgramError('projects and focusSet are required');
  }
  const owners = new Map();
  for (const project of input.projects) {
    validateProject(project);
    for (const identity of [project.slug, ...project.aliases]) {
      const key = normalizeIdentity(identity);
      const previous = owners.get(key);
      if (previous && previous !== project.slug) throw new MarketingProgramError(`identity ${identity} belongs to both ${previous} and ${project.slug}`);
      owners.set(key, project.slug);
    }
  }
  const exclusions = new Set();
  for (const exclusion of input.catalogExclusions ?? []) {
    if (!SLUG.test(exclusion?.slug ?? '') || !exclusion.reason?.trim()) {
      throw new MarketingProgramError('catalogExclusions require a valid slug and reason');
    }
    const key = normalizeIdentity(exclusion.slug);
    if (exclusions.has(key)) throw new MarketingProgramError(`duplicate catalog exclusion: ${exclusion.slug}`);
    if (owners.has(key)) throw new MarketingProgramError(`catalog exclusion is also a project identity: ${exclusion.slug}`);
    exclusions.add(key);
  }
  const focusModes = input.projects.filter((project) => project.mode === 'focus').map((project) => project.slug).sort();
  const focusSet = [...new Set(input.focusSet)].sort();
  if (focusSet.length !== input.focusSet.length || JSON.stringify(focusSet) !== JSON.stringify(focusModes)) {
    throw new MarketingProgramError('focusSet must contain every and only focus-mode project exactly once');
  }
  for (const slug of options.catalogSlugs ?? options.activeSlugs ?? []) {
    if (exclusions.has(normalizeIdentity(slug))) continue;
    if (!owners.has(normalizeIdentity(slug))) throw new MarketingProgramError(`active Fleet project is missing from registry: ${slug}`);
  }
  const defaults = input.defaults ?? {};
  for (const field of ['globalReviewDebtCeiling', 'focusReviewDebtCeiling', 'freshnessHours']) {
    if (!Number.isSafeInteger(defaults[field]) || defaults[field] < 1) throw new MarketingProgramError(`defaults.${field} must be a positive integer`);
  }
  return structuredClone(input);
}

export function createProjectResolver(registry) {
  const aliases = new Map();
  for (const project of registry.projects) {
    for (const identity of [project.slug, ...project.aliases]) aliases.set(normalizeIdentity(identity), project.slug);
  }
  return (value) => aliases.get(normalizeIdentity(value)) ?? normalizeIdentity(value);
}

function validateProject(project) {
  if (!SLUG.test(project?.slug ?? '') || !project.name || !Array.isArray(project.aliases) || !MODES.has(project.mode) ||
      !project.domainPosture || typeof project.publicMarketing !== 'boolean' || !project.cta || !project.cadence || !Array.isArray(project.channels)) {
    throw new MarketingProgramError(`invalid project entry: ${project?.slug ?? 'unknown'}`);
  }
  if (project.domain !== null) {
    let url;
    try { url = new URL(project.domain); } catch { throw new MarketingProgramError(`${project.slug}.domain must be an absolute URL or null`); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new MarketingProgramError(`${project.slug}.domain must use HTTP(S)`);
  }
  if (project.contentBase && (!project.contentBase.adapter || !project.contentBase.path)) {
    throw new MarketingProgramError(`${project.slug}.contentBase requires adapter and path`);
  }
  if (project.channels.length > 0 && !project.contentBase) throw new MarketingProgramError(`${project.slug} channel program requires a content base`);
  const channelNames = new Set();
  for (const mapping of project.channels) {
    if (!CHANNELS.has(mapping?.channel) || !mapping.accountSlug || channelNames.has(mapping.channel)) {
      throw new MarketingProgramError(`${project.slug} has an invalid or duplicate channel mapping`);
    }
    channelNames.add(mapping.channel);
  }
}

function normalizeIdentity(value) {
  return String(value ?? '').trim().toLowerCase().replaceAll('_', '-');
}

export class MarketingProgramError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MarketingProgramError';
  }
}
