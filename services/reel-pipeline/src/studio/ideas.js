import { resolveStudioLlm } from './llm.js';

const ANGLES = [
  { angle: 'beginner mistakes', hook: 'Most people get this wrong in the first week.', format: 'listicle' },
  { angle: 'myth busting', hook: 'Everything you were told about this is outdated.', format: 'explainer' },
  { angle: 'behind the scenes', hook: 'Here is what it actually looks like day to day.', format: 'walkthrough' },
  { angle: 'before and after', hook: 'Thirty days of doing this changed the result completely.', format: 'before_after' },
  { angle: 'tool comparison', hook: 'I tested the top options so you do not have to.', format: 'comparison' },
  { angle: 'fast tutorial', hook: 'You can learn this in under sixty seconds.', format: 'tutorial' },
  { angle: 'contrarian take', hook: 'The popular advice is quietly costing you.', format: 'opinion' },
  { angle: 'case study', hook: 'One real example beats ten theories.', format: 'case_study' },
  { angle: 'roadmap', hook: 'If I started from zero, this is the exact order.', format: 'roadmap' },
  { angle: 'FAQ roundup', hook: 'The five questions everyone asks, answered straight.', format: 'faq' },
];

function titleCase(text) {
  return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));
}

export async function generateIdeas({ niche, count = 10, llm } = {}) {
  if (!niche) throw new Error('niche is required');
  const wanted = Math.max(1, Math.min(25, Number(count) || 10));
  const client = resolveStudioLlm({ llm });
  return client.generate({
    messages: [
      { role: 'system', content: 'You generate YouTube video ideas. Output strict JSON: {"ideas": [{"title": "...", "angle": "...", "hook": "...", "format": "..."}]}. Hooks land in the first 1.5 seconds. Formats: listicle, explainer, walkthrough, comparison, tutorial, opinion, case_study, roadmap, faq, before_after.' },
      { role: 'user', content: `Generate ${wanted} video ideas for the niche: ${niche}` },
    ],
    normalize: (raw) => normalizeIdeas(raw, niche, wanted),
    fallback: () => templateIdeas(niche, wanted),
  });
}

function normalizeIdeas(raw, niche, wanted) {
  const ideas = (Array.isArray(raw?.ideas) ? raw.ideas : [])
    .filter((idea) => idea && typeof idea.title === 'string' && idea.title.trim())
    .map((idea) => ({
      title: idea.title.trim(),
      angle: typeof idea.angle === 'string' ? idea.angle.trim() : 'general',
      hook: typeof idea.hook === 'string' ? idea.hook.trim() : '',
      format: typeof idea.format === 'string' ? idea.format.trim() : 'explainer',
      niche,
    }));
  return { niche, ideas: ideas.length ? ideas.slice(0, wanted) : templateIdeas(niche, wanted).ideas };
}

function templateIdeas(niche, wanted) {
  const base = titleCase(niche.trim());
  const ideas = [];
  for (let i = 0; i < wanted; i += 1) {
    const pick = ANGLES[i % ANGLES.length];
    const round = Math.floor(i / ANGLES.length) + 1;
    const suffix = round > 1 ? ` (Part ${round})` : '';
    ideas.push({
      title: `${base}: ${titleCase(pick.angle)}${suffix}`,
      angle: pick.angle,
      hook: pick.hook,
      format: pick.format,
      niche,
    });
  }
  return { niche, ideas };
}

export async function exploreNiche({ niche, llm } = {}) {
  if (!niche) throw new Error('niche is required');
  const client = resolveStudioLlm({ llm });
  return client.generate({
    messages: [
      { role: 'system', content: 'You analyze YouTube niches. Output strict JSON: {"subNiches": [{"name": "...", "audience": "...", "competition": "low|medium|high", "sampleVideo": "..."}]}.' },
      { role: 'user', content: `Suggest 6 sub-niches inside: ${niche}` },
    ],
    normalize: (raw) => ({
      niche,
      subNiches: (Array.isArray(raw?.subNiches) ? raw.subNiches : []).filter((s) => s && s.name),
    }),
    fallback: () => templateSubNiches(niche),
  });
}

function templateSubNiches(niche) {
  const base = niche.trim().toLowerCase();
  const lenses = [
    ['for beginners', 'people starting from zero', 'medium'],
    ['for busy professionals', 'time-poor practitioners', 'low'],
    ['tools and workflows', 'hands-on tinkerers', 'medium'],
    ['news and updates', 'enthusiasts tracking changes', 'high'],
    ['case studies', 'decision makers wanting proof', 'low'],
    ['mistakes and fixes', 'intermediate learners', 'medium'],
  ];
  return {
    niche,
    subNiches: lenses.map(([suffix, audience, competition]) => ({
      name: `${base} ${suffix}`,
      audience,
      competition,
      sampleVideo: `${titleCase(base)} ${suffix}: the one thing to know`,
    })),
  };
}

export async function suggestChannelNames({ niche, count = 8, llm } = {}) {
  if (!niche) throw new Error('niche is required');
  const wanted = Math.max(1, Math.min(20, Number(count) || 8));
  const client = resolveStudioLlm({ llm });
  return client.generate({
    messages: [
      { role: 'system', content: 'You name YouTube channels. Output strict JSON: {"names": ["..."]}. Short, brandable, no trademark collisions with major brands, 1-3 words.' },
      { role: 'user', content: `Suggest ${wanted} channel names for the niche: ${niche}` },
    ],
    normalize: (raw) => ({
      niche,
      names: (Array.isArray(raw?.names) ? raw.names : []).filter((n) => typeof n === 'string' && n.trim()).slice(0, wanted),
    }),
    fallback: () => templateChannelNames(niche, wanted),
  });
}

function templateChannelNames(niche, wanted) {
  const seed = niche.trim().split(/\s+/)[0] ?? 'creator';
  const word = titleCase(seed);
  const patterns = [
    `${word} Lab`, `${word} Decoded`, `The ${word} Desk`, `${word} Signal`,
    `${word} Playbook`, `Daily ${word}`, `${word} Notes`, `Plain ${word}`,
    `${word} Compass`, `${word} Field Guide`,
  ];
  return { niche, names: patterns.slice(0, wanted) };
}
