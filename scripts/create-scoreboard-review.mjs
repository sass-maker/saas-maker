#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSnapshot, SCORE_CATEGORIES } from '../apps/cockpit/src/lib/scoreboard.ts';

// Explicit local operation: never called by a public build or deploy.
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error(`Required: ${name}`);
  return args[index + 1];
}
const reviewDir = resolve(option('--review-dir'));
const output = resolve(option('--output'));
const repository = resolve(fileURLToPath(new URL('..', import.meta.url)));
function requirePrivateDestination(path) {
  const child = relative(repository, path);
  if (!child.startsWith('..') && !isAbsolute(child))
    throw new Error('Private review output must stay outside the repository.');
}
requirePrivateDestination(output);
const markdownPath = resolve(dirname(output), 'scoreboard-levers.md');
requirePrivateDestination(markdownPath);
const read = async (name) => JSON.parse(await readFile(resolve(reviewDir, name), 'utf8'));
const ratings = await read('ratings-all-active.json');
const policy = await read('scoreboard-policy.json');
const leverGroups = await Promise.all(
  ['market', 'native', 'web', 'root'].map((group) => read(`scoreboard-${group}-levers.json`))
);
const levers = leverGroups.flat();
const internalIds = new Set(policy.internalProjectIds);
const ids = new Set(ratings.map((p) => p.id));
if ([...internalIds].some((id) => !ids.has(id)))
  throw new Error('Internal scope contains an unknown project.');
const reviewManifest = await read('manifest.json');
const assessedAt = new Date(reviewManifest.assembledAt).toISOString().slice(0, 10);
const projects = ratings.map((p) => {
  const internal = internalIds.has(p.id);
  const scores = Object.fromEntries(
    SCORE_CATEGORIES.map((category) => {
      const original = p.scores[category];
      const exempt = (internal && ['seo', 'geo'].includes(category)) || original.score === 'N/A';
      const known = typeof original.score === 'number' && !exempt;
      const evidence = original.evidence.map((e) => ({
        source: e.source,
        date: e.date,
        note: e.note,
      }));
      if (exempt)
        evidence.push({
          source: resolve(reviewDir, 'scoreboard-policy.json'),
          date: assessedAt,
          note: policy.scopeNote,
        });
      return [
        category,
        {
          value: known ? original.score * 2.5 : null,
          status: exempt ? 'not_applicable' : known ? 'estimated' : 'unknown',
          confidence: original.confidence,
          reason: exempt
            ? `Internal utility: public acquisition is outside this review goal. ${original.reason}`
            : original.reason,
          originalValue: original.score,
          evidence,
        },
      ];
    })
  );
  return {
    id: p.id,
    name: p.name,
    segment: p.segment,
    internal,
    domains: p.catalog_identity.domains ?? [],
    sourceRevision: p.source_snapshot.revision,
    limitations: p.limitations,
    bestNextLeverId: `${p.id}:${policy.bestNextCategory[p.id]}`,
    scores,
  };
});
for (const lever of levers) {
  const p = projects.find((p) => p.id === lever.projectId);
  if (!p) throw new Error(`Unknown recommendation project: ${lever.projectId}`);
  lever.kind = p.internal && ['seo', 'geo'].includes(lever.category) ? 'scope' : 'action';
  if (
    lever.projectId === 'site-health' ||
    lever.projectId === 'chatgpt-connections' ||
    lever.projectId === 'saas-maker' ||
    lever.projectId === 'fleet-social' ||
    lever.projectId === 'free-ai' ||
    lever.projectId === 'knowledge-base' ||
    lever.projectId === 'app-health' ||
    lever.projectId === 'unified-portfolio'
  ) {
    lever.why = p.scores[lever.category].reason;
  }
}
// Dependencies must be a DAG, otherwise the one-lever cadence can deadlock.
const byId = new Map(levers.map((l) => [l.id, l]));
const visiting = new Set();
const visited = new Set();
function visit(id) {
  if (visiting.has(id)) throw new Error(`Cyclic dependency at ${id}`);
  if (visited.has(id)) return;
  if (!byId.has(id)) throw new Error(`Unknown dependency: ${id}`);
  visiting.add(id);
  byId.get(id).dependencies.forEach(visit);
  visiting.delete(id);
  visited.add(id);
}
levers.forEach((l) => visit(l.id));
const snapshot = validateSnapshot({
  schemaVersion: 1,
  assessedAt,
  label: `Fleet product review · ${assessedAt}`,
  target: policy.target,
  projects,
  levers,
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
const lines = [
  '# Product scoreboard: recommendations and evidence',
  '',
  `${projects.length} products × six categories = ${levers.length} recommendations. Scores are out of10; target${policy.target}.`,
  '',
  'This is the next bounded lever in each category, not a promise that one change earns the target score. Original assessment dates and limits apply. U is unknown; N/A preserves internal acquisition exemptions. Private source, never publish.',
  '',
];
for (const p of projects) {
  lines.push(
    `## ${p.name}`,
    '',
    p.segment,
    '',
    `Scope: ${p.internal ? 'internal utility' : 'product'}; source${p.sourceRevision}.`,
    ''
  );
  for (const category of SCORE_CATEGORIES) {
    const score = p.scores[category];
    const l = byId.get(`${p.id}:${category}`);
    lines.push(
      `### ${category}: ${score.value ?? (score.status === 'unknown' ? 'U' : 'N/A')}${score.value === null ? '' : '/10'} (${score.confidence})`,
      '',
      `**Next lever:** ${l.title}`,
      '',
      `**Do:** ${l.action}`,
      '',
      `**Why:** ${l.why}`,
      '',
      `**Proof:** ${l.proof}`,
      '',
      `**Priority:** ${l.priority}; ${l.kind}; dependencies: ${l.dependencies.join(', ') || 'none'}.`,
      '',
      '**Evidence:**',
      '',
      ...score.evidence.map((e) => `- ${e.date}: ${e.source} — ${e.note}`),
      ''
    );
  }
}
await writeFile(markdownPath, `${lines.join('\n')}\n`, { mode: 0o600 });
console.log(
  JSON.stringify(
    {
      output,
      markdownPath,
      projects: projects.length,
      recommendations: levers.length,
      actionable: levers.filter((l) => l.kind === 'action').length,
      scopeDecisions: levers.filter((l) => l.kind === 'scope').length,
      unknownScores: projects
        .flatMap((p) => Object.values(p.scores))
        .filter((s) => s.status === 'unknown').length,
    },
    null,
    2
  )
);
