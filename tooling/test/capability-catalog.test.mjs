import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  buildCatalog,
  diagnoseCatalog,
} from '../lib/capability-catalog.mjs';

const repositoryRoot = resolve(import.meta.dirname, '..');

test('standalone capability catalog has valid roots and execution profiles', () => {
  const catalog = buildCatalog(repositoryRoot);
  const diagnosis = diagnoseCatalog(catalog);

  assert.equal(diagnosis.healthy, true, JSON.stringify(diagnosis.issues, null, 2));
  assert.deepEqual(
    catalog.roots.map((root) => root.path),
    ['skills', 'scripts', 'templates', 'docs'],
  );
  assert.equal(catalog.generatedFrom, 'sass-maker/saas-maker/tooling');

  const skills = catalog.items.filter((item) => item.type === 'skill');
  const siteLayout = catalog.items.find((item) =>
    item.path.endsWith('templates/web-landing/src/layouts/SiteLayout.astro'));
  assert.ok(siteLayout, 'web-landing SiteLayout Astro source is cataloged');
  assert.match(siteLayout.summary, /^Template source file:/);
  assert.doesNotMatch(siteLayout.summary, /<!doctype|<html/i);
  const webLandingReadme = catalog.items.find((item) =>
    item.path === 'templates/web-landing/README.md');
  assert.ok(webLandingReadme, 'web-landing README is cataloged');
  assert.doesNotMatch(webLandingReadme.summary, /^Fleet template:/);
  assert.ok(webLandingReadme.summary.length > 20);
  assert.equal(skills.length, 44);
  assert.equal(skills.filter((skill) => skill.path === 'skills/marketing/SKILL.md').length, 1);
  assert.equal(skills.filter((skill) => skill.path === 'skills/agentic-seo/SKILL.md').length, 1);
  assert.equal(
    skills.filter((skill) => skill.path === 'skills/distributed-brand-search/SKILL.md').length,
    1,
  );
  assert.equal(skills.every((skill) => skill.executionProfile), true);
  assert.equal(skills.every((skill) => skill.path.startsWith('skills/')), true);
  assert.equal(
    skills.some((skill) => skill.path === 'skills/clarity-fleet-health/SKILL.md'),
    true,
  );

  assert.deepEqual(
    catalog.items
      .filter((item) => item.type === 'script')
      .map((item) => item.path),
    [
      'scripts/agent-stack.sh',
      'scripts/apply-clarity-id.sh',
      'scripts/audit.mjs',
      'scripts/check-github-actions-policy.mjs',
      'scripts/fleet-capabilities.mjs',
      'scripts/fleet-workspace.mjs',
      'scripts/git-health.sh',
      'scripts/github-priority-queue.mjs',
      'scripts/link-project-agent-assets.sh',
      'scripts/slop-score.mjs',
      'scripts/unlink-project-agent-assets.sh',
      'scripts/validate-tooling.mjs',
      'scripts/verify-local.mjs',
    ],
  );
  assert.equal(
    catalog.items.some((item) => item.path === 'scripts/ahrefs-site-audit-health.mjs'),
    false,
  );
  assert.equal(
    catalog.items.some((item) => item.path === 'scripts/ai-visibility-canary.mjs'),
    false,
  );
  assert.equal(
    catalog.items.some((item) => item.path === 'scripts/founder-control.mjs'),
    false,
  );
});
