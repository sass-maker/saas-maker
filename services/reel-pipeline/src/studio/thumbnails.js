import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveStudioLlm } from './llm.js';

const CONCEPT_BANK = [
  { composition: 'extreme close-up on subject, rule of thirds, blurred background', emotion: 'curiosity', colors: ['#0f172a', '#facc15'] },
  { composition: 'split screen before/after with bold divider', emotion: 'surprise', colors: ['#7f1d1d', '#f8fafc'] },
  { composition: 'big number or stat centered, subject small in corner', emotion: 'authority', colors: ['#052e16', '#4ade80'] },
  { composition: 'arrow pointing at the key object, high contrast vignette', emotion: 'urgency', colors: ['#1e1b4b', '#fb7185'] },
  { composition: 'clean product-on-gradient hero shot with drop shadow', emotion: 'trust', colors: ['#111827', '#38bdf8'] },
];

export async function generateThumbnailConcepts({ topic, count = 3, llm } = {}) {
  if (!topic) throw new Error('topic is required');
  const wanted = Math.max(1, Math.min(6, Number(count) || 3));
  const client = resolveStudioLlm({ llm });
  return client.generate({
    messages: [
      { role: 'system', content: 'You design YouTube thumbnails. Output strict JSON: {"concepts": [{"composition": "...", "overlayText": "max 4 words", "emotion": "...", "colors": ["#hex", "#hex"]}]}.' },
      { role: 'user', content: `Design ${wanted} thumbnail concepts for a video about: ${topic}` },
    ],
    normalize: (raw) => normalizeConcepts(raw, topic, wanted),
    fallback: () => templateConcepts(topic, wanted),
  });
}

function normalizeConcepts(raw, topic, wanted) {
  const concepts = (Array.isArray(raw?.concepts) ? raw.concepts : [])
    .filter((c) => c && typeof c.composition === 'string')
    .map((c) => ({
      composition: c.composition.trim(),
      overlayText: clampOverlay(typeof c.overlayText === 'string' ? c.overlayText : topic),
      emotion: typeof c.emotion === 'string' ? c.emotion.trim() : 'curiosity',
      colors: Array.isArray(c.colors) && c.colors.length >= 2 ? c.colors.slice(0, 3) : ['#0f172a', '#facc15'],
    }));
  return { topic, concepts: concepts.length ? concepts.slice(0, wanted) : templateConcepts(topic, wanted).concepts };
}

function templateConcepts(topic, wanted) {
  const concepts = CONCEPT_BANK.slice(0, wanted).map((base, index) => ({
    ...base,
    overlayText: clampOverlay(overlayFor(topic, index)),
  }));
  return { topic, concepts };
}

function overlayFor(topic, index) {
  const words = topic.trim().split(/\s+/);
  const key = words.slice(0, 2).join(' ');
  const variants = [`${key} truth`, `${key} in 60s`, `stop doing this`, `${key} works`, `${key} exposed`];
  return variants[index % variants.length];
}

export function clampOverlay(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}

export async function renderConceptHtml(concept, outputDir) {
  const dir = path.resolve(outputDir ?? './tmp/studio/thumbnails');
  await mkdir(dir, { recursive: true });
  const [bg, accent] = concept.colors ?? ['#0f172a', '#facc15'];
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; }
  .thumb {
    width: 1280px; height: 720px; position: relative; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 30% 30%, ${accent}22, ${bg});
    font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .overlay {
    color: #fff; font-size: 132px; font-weight: 900; text-transform: uppercase;
    text-align: center; line-height: 1.05; padding: 0 60px;
    text-shadow: 0 6px 0 ${bg}, 0 10px 30px rgba(0,0,0,.6);
    -webkit-text-stroke: 3px ${accent};
  }
  .note { position: absolute; bottom: 24px; left: 24px; color: ${accent}; font-size: 28px; opacity: .8; }
</style>
</head>
<body>
  <div class="thumb">
    <div class="overlay">${escapeHtml(concept.overlayText ?? '')}</div>
    <div class="note">${escapeHtml(concept.composition ?? '')} · ${escapeHtml(concept.emotion ?? '')}</div>
  </div>
</body>
</html>
`;
  const slug = (concept.overlayText ?? 'concept').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'concept';
  const filePath = path.join(dir, `${slug}.html`);
  await writeFile(filePath, html);
  return filePath;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
