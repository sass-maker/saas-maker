import { resolveStudioLlm } from './llm.js';

const TITLE_MAX = 100;
const TAG_BUDGET = 500;

const TITLE_PATTERNS = [
  (t) => `How ${t} Actually Works`,
  (t) => `${t}: What Nobody Tells You`,
  (t) => `I Tried ${t} So You Don't Have To`,
  (t) => `${t} Explained in Plain English`,
  (t) => `The Truth About ${t}`,
  (t) => `${t} — Beginner Mistakes to Avoid`,
  (t) => `Why ${t} Matters More Than You Think`,
];

function titleCase(text) {
  return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));
}

export async function generateTitles({ topic, count = 5, llm } = {}) {
  if (!topic) throw new Error('topic is required');
  const wanted = Math.max(1, Math.min(12, Number(count) || 5));
  const client = resolveStudioLlm({ llm });
  return client.generate({
    messages: [
      { role: 'system', content: 'You write YouTube titles. Output strict JSON: {"titles": ["..."]}. Titles under 100 chars, curiosity-driven, no clickbait lies, no ALL CAPS.' },
      { role: 'user', content: `Write ${wanted} title options for a video about: ${topic}` },
    ],
    normalize: (raw) => normalizeTitles(raw, topic, wanted),
    fallback: () => templateTitles(topic, wanted),
  });
}

function normalizeTitles(raw, topic, wanted) {
  const titles = (Array.isArray(raw?.titles) ? raw.titles : [])
    .filter((t) => typeof t === 'string' && t.trim())
    .map((t) => t.trim().slice(0, TITLE_MAX));
  return { topic, titles: titles.length ? titles.slice(0, wanted) : templateTitles(topic, wanted).titles };
}

function templateTitles(topic, wanted) {
  const base = titleCase(topic.trim());
  const titles = TITLE_PATTERNS.map((make) => make(base).slice(0, TITLE_MAX)).slice(0, wanted);
  return { topic, titles };
}

export async function generateDescription({ topic, hook, cta, hashtags = [], llm } = {}) {
  if (!topic) throw new Error('topic is required');
  const client = resolveStudioLlm({ llm });
  return client.generate({
    messages: [
      { role: 'system', content: 'You write YouTube descriptions. Output strict JSON: {"description": "..."}. Shape: 1-line hook, 2-3 sentence summary, "Chapters:" placeholder block, call to action, hashtag line.' },
      { role: 'user', content: `Video topic: ${topic}\nHook: ${hook ?? 'none provided'}\nCTA: ${cta ?? 'subscribe'}\nHashtags: ${hashtags.join(' ')}` },
    ],
    normalize: (raw) => ({
      topic,
      description: typeof raw?.description === 'string' && raw.description.trim()
        ? raw.description.trim()
        : templateDescription(topic, hook, cta, hashtags).description,
    }),
    fallback: () => templateDescription(topic, hook, cta, hashtags),
  });
}

function templateDescription(topic, hook, cta, hashtags) {
  const lines = [
    hook?.trim() || `${titleCase(topic)} — explained simply.`,
    '',
    `In this video we break down ${topic}: what it is, why it matters, and the practical takeaways you can use today.`,
    '',
    'Chapters:',
    '00:00 Intro',
    '00:30 The core idea',
    '01:30 Walkthrough',
    '02:30 Takeaways',
    '',
    cta?.trim() || 'If this helped, subscribe for more.',
  ];
  const tagLine = hashtags.filter(Boolean).join(' ');
  if (tagLine) lines.push('', tagLine);
  return { topic, description: lines.join('\n') };
}

export async function generateTags({ topic, niche, llm } = {}) {
  if (!topic) throw new Error('topic is required');
  const client = resolveStudioLlm({ llm });
  const result = await client.generate({
    messages: [
      { role: 'system', content: 'You produce YouTube tags. Output strict JSON: {"tags": ["..."]}. Mix broad and specific phrases, lowercase, 2-4 words each, no hashes.' },
      { role: 'user', content: `Tags for a video about: ${topic}${niche ? ` (channel niche: ${niche})` : ''}` },
    ],
    normalize: (raw) => ({ tags: Array.isArray(raw?.tags) ? raw.tags : [] }),
    fallback: () => ({ tags: templateTags(topic, niche) }),
  });
  return { source: result.source, topic, ...organizeTags(result.data.tags.length ? result.data.tags : templateTags(topic, niche)) };
}

function templateTags(topic, niche) {
  const base = topic.trim().toLowerCase();
  const words = base.split(/\s+/).filter(Boolean);
  const tags = [
    base,
    `${base} explained`,
    `${base} tutorial`,
    `${base} for beginners`,
    `how to ${base}`,
    `${base} tips`,
    `what is ${base}`,
    ...words.filter((w) => w.length > 3),
  ];
  if (niche) tags.push(niche.toLowerCase(), `${niche.toLowerCase()} videos`);
  return tags;
}

export function organizeTags(tags) {
  const seen = new Set();
  const cleaned = [];
  for (const tag of tags ?? []) {
    if (typeof tag !== 'string') continue;
    const normalized = tag.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, ' ');
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(normalized);
  }
  // Rank: multi-word phrases first (search intent), then shorter fillers.
  cleaned.sort((a, b) => {
    const aWords = a.split(' ').length;
    const bWords = b.split(' ').length;
    if (aWords !== bWords) return bWords - aWords;
    return a.length - b.length;
  });
  const kept = [];
  let budget = 0;
  for (const tag of cleaned) {
    const cost = tag.length + (kept.length ? 1 : 0);
    if (budget + cost > TAG_BUDGET) continue;
    kept.push(tag);
    budget += cost;
  }
  return { tags: kept, joinedLength: kept.join(',').length, dropped: cleaned.length - kept.length };
}

export function buildHashtags(topic, extra = []) {
  const base = topic.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = base.split(/\s+/).filter(Boolean);
  const tags = new Set();
  if (words.length) tags.add(`#${words.join('')}`.slice(0, 30));
  for (const word of words) {
    if (word.length > 3) tags.add(`#${word}`);
  }
  for (const tag of extra) {
    if (typeof tag === 'string' && tag.trim()) {
      tags.add(tag.startsWith('#') ? tag.toLowerCase() : `#${tag.trim().toLowerCase()}`);
    }
  }
  return [...tags].slice(0, 8);
}
