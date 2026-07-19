import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ARTIFACT_DIR = './artifacts/html-composition';
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

export class HtmlCompositionAdapter {
  constructor(options = {}) {
    this.artifactDir = options.artifactDir ?? process.env.REEL_HTML_COMPOSITION_ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR;
    this.now = options.now ?? (() => new Date());
  }

  async createVideo(brief) {
    const taskId = `html_${stableSlug(brief.id)}_${this.now().getTime()}`;
    const dir = path.resolve(this.artifactDir, taskId);
    await mkdir(dir, { recursive: true });

    const composition = buildHtmlComposition(brief);
    const previewHtmlPath = path.join(dir, 'composition.html');
    const timelinePath = path.join(dir, 'timeline.json');
    const captionsPath = path.join(dir, 'captions.json');
    const manifestPath = path.join(dir, 'manifest.json');

    await writeFile(previewHtmlPath, composition.html);
    await writeFile(timelinePath, `${JSON.stringify(composition.timeline, null, 2)}\n`);
    await writeFile(captionsPath, `${JSON.stringify(composition.captions, null, 2)}\n`);

    const render = {
      provider: 'html-composition',
      externalTaskId: taskId,
      status: 'completed',
      videos: [],
      durationSeconds: composition.timeline.durationSeconds,
      proofType: 'generated_card',
      captionText: brief.hook,
      renderLog: [
        'style=html-css-composition',
        `scenes=${composition.timeline.scenes.length}`,
        `captions=${composition.captions.length}`,
        `durationSeconds=${composition.timeline.durationSeconds}`,
      ],
      raw: {
        previewHtmlPath,
        timelinePath,
        captionsPath,
        manifestPath,
        aspect: '9:16',
        width: WIDTH,
        height: HEIGHT,
        fps: FPS,
      },
    };

    await writeFile(manifestPath, `${JSON.stringify({ taskId, brief, render }, null, 2)}\n`);
    return render;
  }

  async getStatus(externalTaskId) {
    const manifestPath = path.resolve(this.artifactDir, externalTaskId, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    return manifest.render;
  }
}

export function buildHtmlComposition(brief) {
  const durationSeconds = clampDuration(brief.durationSeconds ?? 20);
  const palette = paletteFor(brief.projectSlug);
  const sceneTexts = buildSceneTexts(brief);
  const scenes = distributeScenes(sceneTexts, durationSeconds).map((scene, index) => ({
    id: `scene-${index + 1}`,
    index,
    kind: scene.kind,
    start: round(scene.start),
    duration: round(scene.duration),
    end: round(scene.start + scene.duration),
    title: scene.title,
    caption: scene.caption,
    motion: ['rise', 'push', 'split', 'settle'][index % 4],
    accent: palette.accent,
  }));

  const captions = scenes.flatMap((scene) => captionsForScene(scene));
  const timeline = {
    format: 'html-composition-v1',
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    aspect: '9:16',
    durationSeconds,
    projectSlug: brief.projectSlug,
    title: brief.title,
    scenes,
  };

  return {
    timeline,
    captions,
    html: renderHtml({ brief, timeline, captions, palette }),
  };
}

function buildSceneTexts(brief) {
  const bodySentences = splitSentences(cleanBody(brief.body)).slice(0, 3);
  const bodyScenes = bodySentences.map((caption, index) => ({
    kind: index === 0 ? 'setup' : 'proof',
    title: index === 0 ? 'Why now' : `Proof ${index}`,
    caption,
  }));
  return [
    { kind: 'hook', title: brief.title, caption: brief.hook },
    ...bodyScenes,
    ...(brief.cta ? [{ kind: 'cta', title: 'Next step', caption: brief.cta }] : []),
  ].slice(0, 5);
}

function distributeScenes(sceneTexts, durationSeconds) {
  const count = Math.max(1, sceneTexts.length);
  const base = durationSeconds / count;
  let cursor = 0;
  return sceneTexts.map((scene, index) => {
    const duration = index === count - 1 ? durationSeconds - cursor : base;
    const out = { ...scene, start: cursor, duration };
    cursor += duration;
    return out;
  });
}

function captionsForScene(scene) {
  const words = scene.caption.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const cueDuration = scene.duration / Math.ceil(words.length / 4);
  const cues = [];
  for (let i = 0; i < words.length; i += 4) {
    const cueWords = words.slice(i, i + 4);
    const start = scene.start + cues.length * cueDuration;
    const end = Math.min(scene.end, start + cueDuration);
    cues.push({
      sceneId: scene.id,
      start: round(start),
      end: round(end),
      text: cueWords.join(' '),
      words: cueWords.map((word, wordIndex) => {
        const wordDuration = (end - start) / cueWords.length;
        return {
          text: word,
          start: round(start + wordDuration * wordIndex),
          end: round(start + wordDuration * (wordIndex + 1)),
        };
      }),
    });
  }
  return cues;
}

function renderHtml({ brief, timeline, captions, palette }) {
  const sceneMarkup = timeline.scenes
    .map((scene) => `
      <section class="scene scene-${scene.index}" data-scene="${scene.id}">
        <div class="label">${escapeHtml(scene.kind)}</div>
        <h1>${escapeHtml(scene.title)}</h1>
        <p>${escapeHtml(scene.caption)}</p>
        <div class="meter"><span></span></div>
      </section>`)
    .join('\n');
  const sceneCss = timeline.scenes.map((scene) => sceneAnimationCss(scene, timeline.durationSeconds)).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(brief.title)} - HTML composition preview</title>
  <style>
    :root {
      --bg: ${palette.bg};
      --fg: ${palette.fg};
      --muted: ${palette.muted};
      --accent: ${palette.accent};
      --duration: ${timeline.durationSeconds}s;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body { margin: 0; background: #111; color: var(--fg); display: grid; min-height: 100vh; place-items: center; }
    .stage {
      position: relative;
      width: min(100vw, ${WIDTH}px);
      aspect-ratio: 9 / 16;
      overflow: hidden;
      background:
        radial-gradient(circle at 25% 20%, color-mix(in srgb, var(--accent) 42%, transparent), transparent 28%),
        linear-gradient(160deg, var(--bg), #08090d 72%);
      box-shadow: 0 24px 80px rgb(0 0 0 / 48%);
      isolation: isolate;
    }
    .stage::before { content: ""; position: absolute; inset: 5%; border: 1px solid rgb(255 255 255 / 14%); }
    .brand { position: absolute; left: 56px; top: 56px; color: var(--muted); font-size: 24px; letter-spacing: .08em; text-transform: uppercase; }
    .scene {
      position: absolute;
      inset: 150px 72px 180px;
      display: grid;
      align-content: center;
      gap: 26px;
      opacity: 0;
      transform: translateY(28px) scale(.985);
      animation-duration: var(--duration);
      animation-fill-mode: both;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }
    .label { color: var(--accent); font-size: 28px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; max-width: 900px; font-size: 92px; line-height: .94; letter-spacing: 0; }
    p { margin: 0; max-width: 860px; color: var(--fg); font-size: 54px; line-height: 1.08; }
    .meter { width: 100%; height: 8px; border-radius: 999px; background: rgb(255 255 255 / 13%); overflow: hidden; }
    .meter span { display: block; height: 100%; width: 100%; background: var(--accent); transform-origin: left; animation: meter var(--duration) linear infinite; }
    .caption {
      position: absolute;
      left: 72px;
      right: 72px;
      bottom: 72px;
      min-height: 92px;
      border-radius: 8px;
      background: rgb(0 0 0 / 62%);
      color: white;
      padding: 24px 28px;
      font-size: 38px;
      line-height: 1.08;
    }
    ${sceneCss}
    @keyframes meter { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  </style>
</head>
<body>
  <main class="stage" data-duration="${timeline.durationSeconds}">
    <div class="brand">${escapeHtml(brief.projectSlug)}</div>
${sceneMarkup}
    <div class="caption" id="caption">${escapeHtml(captions[0]?.text ?? brief.hook)}</div>
  </main>
  <script type="application/json" id="timeline">${jsonScript(timeline)}</script>
  <script type="application/json" id="captions">${jsonScript(captions)}</script>
  <script>
    const captions = JSON.parse(document.getElementById('captions').textContent);
    const captionEl = document.getElementById('caption');
    window.setCompositionTime = (seconds) => {
      const cue = captions.find((item) => seconds >= item.start && seconds < item.end) || captions.at(-1);
      if (cue) captionEl.textContent = cue.text;
    };
    setInterval(() => window.setCompositionTime((performance.now() / 1000) % ${timeline.durationSeconds}), 100);
  </script>
</body>
</html>
`;
}

function sceneAnimationCss(scene, durationSeconds) {
  const start = (scene.start / durationSeconds) * 100;
  const fadeIn = Math.min(start + 5, 100);
  const hold = Math.max(start, ((scene.end / durationSeconds) * 100) - 5);
  const end = (scene.end / durationSeconds) * 100;
  return `.scene-${scene.index} { animation-name: scene-${scene.index}; }
    @keyframes scene-${scene.index} {
      0%, ${pct(start)} { opacity: 0; transform: translateY(28px) scale(.985); }
      ${pct(fadeIn)}, ${pct(hold)} { opacity: 1; transform: translateY(0) scale(1); }
      ${pct(end)}, 100% { opacity: 0; transform: translateY(-24px) scale(1.015); }
    }`;
}

function pct(value) {
  return `${Math.max(0, Math.min(100, value)).toFixed(3)}%`;
}

function paletteFor(projectSlug) {
  const palettes = [
    { bg: '#15130f', fg: '#fff7df', muted: '#c7bfa7', accent: '#f2b84b' },
    { bg: '#101923', fg: '#eff9ff', muted: '#9eb7c9', accent: '#43d3ff' },
    { bg: '#111920', fg: '#f5fff9', muted: '#a9c0b0', accent: '#61e294' },
    { bg: '#1d1420', fg: '#fff4ff', muted: '#c6aacd', accent: '#ff83c9' },
  ];
  const index = stableIndex(projectSlug, palettes.length);
  return palettes[index];
}

function cleanBody(body) {
  return String(body ?? '')
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\b(script|shot list|shots|captions?|asset prompts?|visuals?):/gi, '')
    .replace(/[-*]\s+/g, '')
    .trim();
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.slice(0, 150));
}

function clampDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return 20;
  return Math.max(5, Math.min(90, duration));
}

function round(value) {
  return Number(value.toFixed(3));
}

function stableSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'composition';
}

function stableIndex(value, length) {
  const text = String(value ?? '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
