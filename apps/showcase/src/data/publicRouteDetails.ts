import type { PublicRoute } from './publicRoutes';
import { IDEA_ENTRIES, ideaTitle } from './ideas';
import { FUNDING, FUNDING_FIELD_GROUPS, FUNDING_PROGRAMS, FUNDING_VIEWS, field } from './funding';
import { TOOLING_CAPABILITIES } from './tooling';
import { launchdeskRecords } from './launchdeskRecords';

const section = (title: string, rows: string[]) =>
  rows.length ? [`## ${title}`, '', ...rows, ''] : [];
const bullet = (text: string) => `- ${text}`;
const value = (item: unknown): string | null =>
  item === null || item === undefined || item === ''
    ? null
    : Array.isArray(item)
      ? item.join(', ')
      : typeof item === 'boolean'
        ? item
          ? 'Yes'
          : 'No'
        : String(item);

const ideas: PublicRoute[] = IDEA_ENTRIES.map(({ slug, idea }) => ({
  id: `idea-${slug}`,
  path: `/ideas/${slug}`,
  kind: 'profile',
  description: `${ideaTitle(idea)}. Money ${idea.money}, fun ${idea.fun}, solo feasibility ${idea.f_feas}/10 — scored idea from the SaaS Maker ledger.`,
  markdown: [
    `# ${ideaTitle(idea)}`,
    '',
    `Source: ${idea.source}`,
    '',
    `Customer: ${idea.customer === 'b2b-tech' ? 'B2B technology' : idea.customer === 'non-dev' ? 'Non-developer' : 'Individual developer'}`,
    `Money: ${idea.money}; Fun: ${idea.fun}; Adjusted: ${idea.adj}`,
    '',
    ...section('The idea', [idea.idea.replace(/<br\s*\/?\s*>/gi, '\n')]),
    ...section('Score reasoning', [
      `Feasibility — ${idea.f_feas}/10: ${idea.f_feas_why}`,
      ...(idea.best_bet ? [`Best bet: ${idea.best_bet_why}`] : []),
      `Fun ${idea.f} + Tech ${idea.t} = ${idea.fun} · Money ${idea.m} + Feasibility ${idea.f_feas} − Competition ${idea.c} = ${idea.money} · Source: ${idea.source}`,
    ]),
    '## Related',
    '',
    '- [Scored ledger](https://sassmaker.com/ideas)',
    '',
  ].join('\n'),
}));

const tools: PublicRoute[] = TOOLING_CAPABILITIES.map((item) => ({
  id: `tool-${item.id}`,
  path: `/tools/${item.id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`,
  kind: 'profile',
  description: item.summary,
  markdown: [
    `# ${item.name}`,
    '',
    item.summary,
    '',
    `Type: ${item.type}`,
    `ID: ${item.id}`,
    `Path: ${item.path}`,
    '',
    `- [Source on GitHub](https://github.com/sass-maker/saas-maker/blob/main/tooling/${item.path})`,
    '',
    ...(item.executionProfile
      ? section('Execution profile', [
          `Recommended: ${item.executionProfile.recommended.intelligence} · ${item.executionProfile.recommended.reasoning}`,
          `Minimum: ${item.executionProfile.minimum.intelligence} · ${item.executionProfile.minimum.reasoning}`,
          `Degradation: ${item.executionProfile.degradation}`,
        ])
      : []),
    '## Related',
    '',
    '- [Capability register](https://sassmaker.com/tools)',
    '',
  ].join('\n'),
}));

const funding: PublicRoute[] = FUNDING_PROGRAMS.map((program) => ({
  id: `funding-${program.slug}`,
  path: `/funding/${program.slug}`,
  kind: 'profile',
  description: `${program.name} (${value(field(program, 'Organization')) ?? 'organization unresolved'}) — ${value(field(program, 'Category')) ?? 'program'} assessed ${value(field(program, 'Priority')) ?? 'ungraded'} for this portfolio. Part of the SaaS Maker funding directory.`,
  markdown: [
    `# ${program.name}`,
    '',
    ...FUNDING_FIELD_GROUPS.flatMap((group) =>
      section(
        group.title,
        group.fields.flatMap((name) => {
          const text = value(field(program, name));
          return text ? [`- ${name}: ${text}`] : [];
        })
      )
    ),
    ...section(
      'Appears in decision views',
      FUNDING_VIEWS.filter((view) => view.slugs.includes(program.slug)).map((view) =>
        bullet(view.name)
      )
    ),
    `Imported ${FUNDING.exportedAt.slice(0, 10)} from the Funding & Accelerators workspace (rebuilt ${FUNDING.workspaceRebuilt}). Assessments are this portfolio's judgment, not the program's claims; verify against the official source before relying on them.`,
    '',
    '## Related',
    '',
    '- [Funding directory](https://sassmaker.com/funding)',
    '',
  ].join('\n'),
}));

const launches: PublicRoute[] = launchdeskRecords().map(
  ({ params, props: { playbook: p, destination: d } }) => {
    const title = p?.name ?? d?.name ?? params.domain;
    const grade =
      p?.grade === 'researched'
        ? 'Researched from public pages — no submission was run'
        : 'Observed during a real submission run';
    const routeLabel = {
      free: 'Free route',
      conditional: 'Conditional free route',
      paid: 'Paid only',
      unknown: 'Route unverified',
    };
    const content = p
      ? [
          `# ${title}`,
          '',
          `- [${p.domain}](https://${p.domain})`,
          '',
          routeLabel[p.zeroCostRoute],
          ...(p.category ? [p.category] : []),
          '',
          `${grade} · sources read ${p.retrieved}. Rules change — recheck the platform's own pages before submitting.`,
          '',
          ...section('What the free route requires', (p.conditions ?? []).map(bullet)),
          ...section('Requirements', p.requirements.map(bullet)),
          ...section('Prepare before opening the form', p.preparation.map(bullet)),
          ...section(
            'Workflow',
            p.workflow.map((item, i) => `${i + 1}. ${item}`)
          ),
          ...section('Watch for', p.watchFor.map(bullet)),
          ...section('What counts as live', [p.countsAsLive]),
          ...section('Not verified', p.unknowns.map(bullet)),
          ...section(
            'Sources',
            p.sources.map((source) => `- [${source.title || source.url}](${source.url})`)
          ),
        ]
      : d
        ? [
            `# ${title}`,
            '',
            `- [${d.domain}](${d.website})`,
            '',
            d.category,
            ...(d.type ? [d.type] : []),
            d.link === 'unknown' ? 'link unreported' : `${d.link} link`,
            d.pricing === 'unknown' ? 'pricing unreported' : d.pricing,
            d.dr != null ? `Reported DR ${d.dr}` : 'DR unreported',
            ...(d.provider ? [`Metric provenance: ${d.provider}`] : []),
            ...(d.retrieved ? [`Retrieved: ${d.retrieved}`] : []),
            ...(d.measured ? [`Measured: ${d.measured}`] : []),
            '',
            ...section('Submission route', [
              d.submissionUrl ?? 'No verified submission route on file — research needed.',
              ...(d.exampleUrl ? [`Example listing: ${d.exampleUrl}`] : []),
              ...(d.eligibility ? [`Eligibility: ${d.eligibility}`] : []),
              ...(d.flags.length ? [`Flags: ${d.flags.join(' · ')}`] : []),
            ]),
            ...section('Source claims', [
              'Metrics below are source-reported and may disagree between providers — they are kept verbatim rather than smoothed away.',
              ...d.claims.map(
                (claim) =>
                  `- ${claim.source ? `${claim.source}: ` : ''}${claim.dr != null ? `DR ${claim.dr}` : 'DR unreported'}${claim.link ? ` · ${claim.link}` : ''}${claim.pricing ? ` · ${claim.pricing}` : ''}${claim.type ? ` · ${claim.type}` : ''}`
              ),
              ...(d.sourceUrl ? [`Source data: ${d.sourceUrl}`] : []),
            ]),
            ...section('Playbook status', [
              'No researched playbook exists for this destination yet. Researched playbooks are added in authority order; the route and claims above are the honest current record.',
            ]),
          ]
        : [];
    return {
      id: `launchdesk-${params.domain}`,
      path: `/launchdesk/${params.domain}`,
      kind: 'profile',
      description: p
        ? `Submission playbook for ${title} (${params.domain}): requirements, workflow, traps, and what counts as live. ${grade}.`
        : `Catalog record for ${title} (${params.domain}) — source-attributed metrics and submission route status in the SaaS Maker launch catalog.`,
      markdown: [
        ...content,
        '## Related',
        '',
        '- [Launch catalog](https://sassmaker.com/launchdesk)',
        '',
      ].join('\n'),
    };
  }
);

export const PUBLIC_ROUTE_DETAILS = [...ideas, ...tools, ...funding, ...launches];
