import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateDescription } from './metadata.js';
import { generateThumbnailConcepts, renderConceptHtml } from './thumbnails.js';
import { loadPlaywrightFactory } from '../product-proof-capture.js';

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function defaultScreenshotter(htmlPath, pngPath) {
  const browserFactory = await loadPlaywrightFactory();
  if (!browserFactory) return false;
  const browser = await browserFactory();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`file://${htmlPath}`);
    await page.screenshot({ path: pngPath });
    return true;
  } finally {
    await browser.close();
  }
}

/**
 * Build an upload-ready packet next to a faceless run's artifacts:
 * packet/upload.md + thumbnail (PNG when a browser is available, else HTML).
 */
export async function buildPublishPacket({ artifactDir, screenshotter = defaultScreenshotter, llm } = {}) {
  if (!artifactDir) throw new Error('artifactDir is required');
  const script = await readJsonIfPresent(path.join(artifactDir, 'script.json'));
  const metadata = await readJsonIfPresent(path.join(artifactDir, 'metadata.json'));
  const render = await readJsonIfPresent(path.join(artifactDir, 'render.json'));
  const quality = await readJsonIfPresent(path.join(artifactDir, 'quality.json'));
  if (!script) throw new Error(`no script.json in ${artifactDir}`);

  const packetDir = path.join(artifactDir, 'packet');
  await mkdir(packetDir, { recursive: true });

  const title = metadata?.titles?.[0] ?? script.topic;
  const hashtags = (metadata?.hashtags?.length ? metadata.hashtags : script.hashtags) ?? [];
  const description = (await generateDescription({
    topic: script.topic,
    hook: script.hook,
    hashtags,
    llm,
  })).data.description;
  const tagsLine = (metadata?.tags ?? []).join(',');

  const concepts = await generateThumbnailConcepts({ topic: script.topic, count: 1, llm });
  const concept = concepts.data.concepts[0];
  const htmlPath = await renderConceptHtml(concept, packetDir);
  const pngPath = path.join(packetDir, 'thumbnail.png');
  let thumbnail = path.basename(htmlPath);
  try {
    if (await screenshotter(htmlPath, pngPath)) thumbnail = 'thumbnail.png';
  } catch {
    // keep the HTML preview when screenshotting is unavailable
  }

  const upload = [
    `# Upload packet — ${script.topic}`,
    '',
    `- Video: ${render?.videos?.[0] ?? '(render output missing)'}`,
    `- Quality: ${quality ? `${quality.verdict} (${quality.overall}/100)` : 'not assessed'}`,
    `- Duration target: ${script.targetDurationSeconds}s · Voice: ${script.voice}`,
    `- Thumbnail: packet/${thumbnail}`,
    '',
    '## Title',
    '',
    title,
    '',
    ...(metadata?.titles?.length > 1 ? ['### Alternates', '', ...metadata.titles.slice(1).map((t) => `- ${t}`), ''] : []),
    '## Description',
    '',
    description,
    '',
    '## Tags (paste into the tags field)',
    '',
    '```',
    tagsLine,
    '```',
    '',
    '## Hashtags',
    '',
    hashtags.join(' '),
    '',
    '## Checklist',
    '',
    '- [ ] Watch the full video once',
    '- [ ] Title matches the hook on screen',
    '- [ ] Thumbnail readable at small size',
    '- [ ] Schedule or publish, then mark the idea posted (`npm run studio -- status`)',
  ].join('\n');

  const uploadPath = path.join(packetDir, 'upload.md');
  await writeFile(uploadPath, upload);
  return { packetDir, uploadPath, thumbnail: path.join(packetDir, thumbnail), title };
}
