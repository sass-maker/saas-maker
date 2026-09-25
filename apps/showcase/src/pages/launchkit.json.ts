import launchdeskData from '../data/launchdesk.json';

export const prerender = true;

const REPO = 'https://github.com/sass-maker/saas-maker';
const RAW = 'https://raw.githubusercontent.com/sass-maker/saas-maker/main';
const SITE = 'https://sassmaker.com';

const playbookModules = import.meta.glob('../data/launchdesk-playbooks/*.json', {
  eager: true,
});
const playbooks = Object.values(playbookModules)
  .map((mod) => (mod as { default?: { domain?: string } }).default ?? {})
  .filter((p) => p.domain);

export function GET() {
  const manifest = {
    $schema: 'fleet.launchkit-manifest.v1',
    name: 'SaaS Maker Launchkit',
    description:
      'Free agent-executable launch toolkit: one product brief, a truthful run planner over the launchdesk catalog, per-platform submission playbooks, an evidence-based tracker, and a run prompt. The open equivalent of paid launch-repo kits.',
    gradeSemantics:
      'Playbook grade "researched" = assembled from cited public pages; "observed" = witnessed during a real submission run. Tracker states are evidence-based: a draft is prepared, a confirmed date is scheduled, live requires a resolving public URL.',
    quickstart: [
      `curl ${RAW}/tooling/launchkit/brief.template.md -o brief.md  # fill once`,
      `git clone --depth 1 ${REPO}.git  # or fetch the two data files below`,
      'node tooling/launchkit/scripts/plan-run.mjs --brief brief.md --n 10 --out run-plan.json',
      'paste tooling/launchkit/prompts/run.prompt.md into your agent',
      'node tooling/launchkit/scripts/report.mjs --tracker tracker.json',
    ],
    pieces: {
      brief: `${RAW}/tooling/launchkit/brief.template.md`,
      planner: `${RAW}/tooling/launchkit/scripts/plan-run.mjs`,
      runPrompt: `${RAW}/tooling/launchkit/prompts/run.prompt.md`,
      trackerSchema: `${RAW}/tooling/launchkit/tracker.schema.json`,
      trackerTemplate: `${RAW}/tooling/launchkit/tracker.template.json`,
      report: `${RAW}/tooling/launchkit/scripts/report.mjs`,
      readme: `${RAW}/tooling/launchkit/README.md`,
      skill: `${RAW}/tooling/skills/launchkit/SKILL.md`,
    },
    data: {
      catalog: `${SITE}/launchdesk.json`,
      catalogSnapshot: launchdeskData.snapshot,
      destinations: launchdeskData.destinations.length,
      playbookIndex: `${SITE}/launchdesk-playbooks.json`,
      playbookPattern: `${SITE}/launchdesk/<domain>.json`,
      playbookPages: `${SITE}/launchdesk/<domain>`,
      playbookCount: playbooks.length,
      playbookSchema: `${RAW}/apps/showcase/src/data/launchdesk-playbooks/_schema.json`,
    },
    humanPage: `${SITE}/launchkit`,
    catalogPage: `${SITE}/launchdesk`,
    repository: REPO,
    license: 'See repository LICENSE.',
  };
  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
