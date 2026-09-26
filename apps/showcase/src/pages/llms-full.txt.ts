import publicCatalog from '../../../../catalog/generated/public.json';
import { LEARNINGS } from '../data/learnings';
import { STUDIO_PROFILE } from '../data/studio';
export const prerender = true;
export function GET() {
  const projects = publicCatalog.directory.flatMap((project) => {
    return [
      `## ${project.name}`,
      project.description,
      `Group: ${project.group}`,
      `Form: ${project.form}`,
      `Platforms: ${project.platforms.join(', ')}`,
      `Uses: ${project.technologies.join(', ')}`,
      `Deployment: ${project.deployed ? 'deployed' : 'not deployed'}`,
      ...project.domains.map((domain) => `Destination: https://${domain}`),
      ...(project.repositoryUrl ? [`Source: ${project.repositoryUrl}`] : []),
      `First retained commit: ${project.firstCommitAt ?? 'not retained'}`,
      `Latest retained commit: ${project.latestCommitAt ?? 'not retained'}`,
      '',
    ];
  });
  const body = [
    '# SaaS Maker — full product index',
    '',
    STUDIO_PROFILE.oneLine,
    '',
    `Founder and builder: ${STUDIO_PROFILE.owner.name} (${STUDIO_PROFILE.owner.url})`,
    '',
    '## Studio thesis',
    '',
    STUDIO_PROFILE.thesis,
    '',
    `> ${STUDIO_PROFILE.ownerVoice}`,
    '',
    `Full studio page: https://sassmaker.com/studio.md`,
    '',
    'Generated from the checked-in Fleet public projection. Configuration and links do not imply fresh production verification.',
    '',
    '# Funding directory',
    '',
    "A 184-program funding and accelerator directory imported from the Funding & Accelerators workspace — one row per specific program, with per-row evidence grading, fit, terms, deadlines, and the workspace's 16 decision views.",
    '',
    'Directory: https://sassmaker.com/funding',
    'Dataset: https://sassmaker.com/funding.json',
    'Per-program records: https://sassmaker.com/funding/<slug> and .json',
    'Docs: https://sassmaker.com/funding/docs/strategy, materials, methodology, archive',
    '',
    '# Domain ranks',
    '',
    'Provider-reported Ahrefs Domain Rating history for all owned Fleet domains — weekly snapshot; a missing rating means "not reported", never zero.',
    '',
    'Board: https://sassmaker.com/ranks',
    'Dataset: https://sassmaker.com/ranks.json',
    '',
    '# Learnings',
    '',
    ...LEARNINGS.flatMap((learning) => [
      `## ${learning.title}`,
      learning.description,
      `Article: https://sassmaker.com${learning.href}`,
      `Published: ${learning.publishedAt}`,
      `Author: ${learning.author}`,
      '',
    ]),
    '# Complete project directory',
    '',
    publicCatalog.historySemantics,
    '',
    ...projects,
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
