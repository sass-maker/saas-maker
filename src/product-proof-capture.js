import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_VIEWPORT = { width: 1080, height: 1920 };
const DEFAULT_RECORDING_VIEWPORT = { width: 720, height: 1280 };

export class ProductProofCapture {
  constructor(options = {}) {
    this.outputDir = options.outputDir ?? path.resolve('./tmp/product-proof');
    this.browserFactory = options.browserFactory ?? null;
    this.commandRunner = options.commandRunner ?? defaultCommandRunner;
    this.screenshotFinder = options.screenshotFinder ?? defaultScreenshotFinder;
    this.logger = options.logger ?? noopLogger;
    this.viewport = options.viewport ?? DEFAULT_VIEWPORT;
    this.recordingViewport = options.recordingViewport ?? DEFAULT_RECORDING_VIEWPORT;
    this.now = options.now ?? (() => new Date());
  }

  async capture(brief, options = {}) {
    const variantSuffix = options.variantId ? `-${options.variantId}` : '';
    const slug = stableSlug(`${brief.projectSlug}-${brief.id}${variantSuffix}`);
    const sceneDir = path.join(this.outputDir, slug);
    await mkdir(sceneDir, { recursive: true });

    const reasons = [];

    if (options.preferRecording && Array.isArray(brief.demoSteps) && brief.demoSteps.length) {
      const recording = await this.tryRecording(brief, sceneDir, reasons);
      if (recording) return recording;
    }

    if (brief.productUrl || brief.proofUrl || brief.targetRoute) {
      const screenshot = await this.tryScreenshot(brief, sceneDir, reasons);
      if (screenshot) return screenshot;
    }

    if (Array.isArray(brief.screenshots) && brief.screenshots.length) {
      const supplied = await this.trySuppliedScreenshots(brief.screenshots, sceneDir, reasons);
      if (supplied) return supplied;
    }

    const repo = await this.tryRepoScreenshot(brief, sceneDir, reasons);
    if (repo) return repo;

    return this.generateFallbackCards(brief, sceneDir, reasons);
  }

  async tryScreenshot(brief, sceneDir, reasons) {
    if (!this.browserFactory) {
      reasons.push('no browser available for live capture');
      return null;
    }
    const targetUrl = resolveTargetUrl(brief);
    if (!targetUrl) {
      reasons.push('no productUrl or targetRoute to capture');
      return null;
    }
    const filePath = path.join(sceneDir, 'product-screenshot.png');
    let browser;
    try {
      browser = await this.browserFactory({ headless: true });
      const context = await browser.newContext({ viewport: this.viewport });
      const page = await context.newPage();
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.screenshot({ path: filePath, fullPage: false });
      await context.close();
      reasons.push(`captured live screenshot from ${targetUrl}`);
      return {
        type: 'screenshot',
        proofType: 'screenshot',
        paths: [filePath],
        reasons,
        primary: filePath,
        sceneDir,
      };
    } catch (error) {
      reasons.push(`live screenshot failed: ${formatError(error)}`);
      this.logger.warn?.('product-proof-capture screenshot failed', error);
      return null;
    } finally {
      if (browser) {
        try { await browser.close(); } catch (closeError) {
          this.logger.warn?.('browser close failed', closeError);
        }
      }
    }
  }

  async tryRecording(brief, sceneDir, reasons) {
    if (!this.browserFactory) {
      reasons.push('no browser available for recording');
      return null;
    }
    const targetUrl = resolveTargetUrl(brief);
    if (!targetUrl) {
      reasons.push('no productUrl for recording');
      return null;
    }
    const recordingDir = path.join(sceneDir, 'recording');
    await mkdir(recordingDir, { recursive: true });
    let browser;
    try {
      browser = await this.browserFactory({ headless: true });
      const context = await browser.newContext({
        viewport: this.recordingViewport,
        recordVideo: { dir: recordingDir, size: this.recordingViewport },
      });
      const page = await context.newPage();
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30_000 });
      for (const step of brief.demoSteps ?? []) {
        await runDemoStep(page, step);
      }
      await context.close();
      const videoPath = await firstFileIn(recordingDir);
      if (!videoPath) {
        reasons.push('recording produced no file');
        return null;
      }
      reasons.push(`recorded demo flow on ${targetUrl}`);
      return {
        type: 'recording',
        proofType: 'recording',
        paths: [videoPath],
        reasons,
        primary: videoPath,
        sceneDir,
      };
    } catch (error) {
      reasons.push(`recording failed: ${formatError(error)}`);
      this.logger.warn?.('product-proof-capture recording failed', error);
      return null;
    } finally {
      if (browser) {
        try { await browser.close(); } catch (closeError) {
          this.logger.warn?.('browser close failed', closeError);
        }
      }
    }
  }

  async trySuppliedScreenshots(screenshots, sceneDir, reasons) {
    const copied = [];
    for (const supplied of screenshots) {
      const localPath = await resolveLocalAsset(supplied);
      if (!localPath) {
        reasons.push(`skipped supplied screenshot ${supplied} (not local)`);
        continue;
      }
      const destination = path.join(sceneDir, `supplied-${path.basename(localPath)}`);
      await copyFile(localPath, destination);
      copied.push(destination);
    }
    if (!copied.length) return null;
    reasons.push(`used ${copied.length} supplied screenshot(s)`);
    return {
      type: 'screenshot',
      proofType: 'screenshot',
      paths: copied,
      reasons,
      primary: copied[0],
      sceneDir,
    };
  }

  async tryRepoScreenshot(brief, sceneDir, reasons) {
    const found = await this.screenshotFinder(brief);
    if (!found) {
      reasons.push('no repo screenshot found');
      return null;
    }
    const destination = path.join(sceneDir, `repo-${path.basename(found)}`);
    await copyFile(found, destination);
    reasons.push(`used repo screenshot ${found}`);
    return {
      type: 'repo_screenshot',
      proofType: 'screenshot',
      paths: [destination],
      reasons,
      primary: destination,
      sceneDir,
    };
  }

  async generateFallbackCards(brief, sceneDir, reasons) {
    const cards = [];
    const palette = pickPalette(brief.projectSlug);
    for (let index = 0; index < 3; index += 1) {
      const cardPath = path.join(sceneDir, `card-${index + 1}.png`);
      await renderFallbackCard(cardPath, palette[index % palette.length], this.commandRunner);
      cards.push(cardPath);
    }
    reasons.push('generated fallback cards (no product proof available)');
    return {
      type: 'generated_card',
      proofType: 'generated_card',
      paths: cards,
      reasons,
      primary: cards[0],
      sceneDir,
    };
  }
}

export async function defaultScreenshotFinder(brief) {
  const candidates = [
    path.resolve('assets', brief.projectSlug ?? '', 'screenshot.png'),
    path.resolve('assets', `${brief.projectSlug ?? ''}.png`),
    path.resolve('docs', 'screenshots', `${brief.projectSlug ?? ''}.png`),
    path.resolve('..', brief.projectSlug ?? '', 'docs', 'screenshot.png'),
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  const dirs = [
    path.resolve('assets', brief.projectSlug ?? ''),
    path.resolve('docs', 'screenshots'),
  ];
  for (const dir of dirs) {
    try {
      const entries = await readdir(dir);
      const image = entries.find((entry) => /\.(png|jpg|jpeg)$/i.test(entry));
      if (image) return path.join(dir, image);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

async function resolveLocalAsset(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (value.startsWith('file://')) return new URL(value).pathname;
  if (value.startsWith('http://') || value.startsWith('https://')) return null;
  const absolute = path.isAbsolute(value) ? value : path.resolve(value);
  return (await fileExists(absolute)) ? absolute : null;
}

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function firstFileIn(dir) {
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const info = await stat(full);
      if (info.isFile()) return full;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return null;
}

async function runDemoStep(page, step) {
  const wait = Number.isFinite(Number(step.waitMs)) ? Number(step.waitMs) : 600;
  switch (step.action) {
    case 'goto':
      if (step.route) await page.goto(step.route, { waitUntil: 'networkidle', timeout: 30_000 });
      break;
    case 'click':
      if (step.selector) await page.click(step.selector, { timeout: 15_000 });
      break;
    case 'fill':
      if (step.selector && step.value) await page.fill(step.selector, step.value, { timeout: 15_000 });
      break;
    case 'press':
      if (step.value) await page.keyboard.press(step.value);
      break;
    case 'wait':
      break;
    default:
      if (step.selector) {
        try { await page.click(step.selector, { timeout: 5_000 }); } catch { /* ignore */ }
      }
  }
  await page.waitForTimeout?.(wait);
}

function resolveTargetUrl(brief) {
  if (brief.proofUrl) return brief.proofUrl;
  if (brief.productUrl && brief.targetRoute) {
    try {
      return new URL(brief.targetRoute, brief.productUrl).toString();
    } catch {
      return brief.productUrl;
    }
  }
  if (brief.productUrl) return brief.productUrl;
  return null;
}

function pickPalette(projectSlug) {
  const palettes = [
    [['0x08111f', '0x22d3ee'], ['0x130b1f', '0xa78bfa'], ['0x101607', '0xbef264']],
    [['0x111827', '0xf59e0b'], ['0x1f2937', '0x34d399'], ['0x0f172a', '0xf472b6']],
    [['0x0c0a09', '0xfacc15'], ['0x1c1917', '0x60a5fa'], ['0x09090b', '0xf87171']],
  ];
  const index = Math.abs(hashCode(projectSlug ?? 'default')) % palettes.length;
  return palettes[index];
}

function hashCode(value) {
  let hash = 0;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

async function renderFallbackCard(filePath, [bg, accent], commandRunner) {
  const filter = [
    `color=c=${bg}:s=1080x1920:d=1`,
    `drawbox=x=72:y=120:w=936:h=1680:color=${accent}@0.18:t=fill`,
    `drawbox=x=72:y=120:w=936:h=1680:color=${accent}@0.78:t=8`,
    'drawbox=x=132:y=240:w=816:h=420:color=white@0.08:t=fill',
    'drawbox=x=132:y=760:w=816:h=760:color=black@0.28:t=fill',
    'drawbox=x=192:y=1040:w=696:h=310:color=white@0.10:t=fill',
    `drawbox=x=232:y=1090:w=616:h=70:color=${accent}@0.75:t=fill`,
    'drawbox=x=232:y=1200:w=420:h=34:color=white@0.25:t=fill',
    'drawbox=x=232:y=1270:w=520:h=34:color=white@0.18:t=fill',
  ].join(',');
  try {
    await commandRunner('ffmpeg', ['-y', '-f', 'lavfi', '-i', filter, '-frames:v', '1', filePath], { timeout: 60_000 });
  } catch (error) {
    await writeFile(filePath, `fallback card placeholder for ${filePath}\n`);
  }
}

function stableSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
}

function formatError(error) {
  if (!error) return 'unknown error';
  if (error instanceof Error) return error.message;
  return String(error);
}

async function defaultCommandRunner(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: options.cwd,
    timeout: options.timeout,
    maxBuffer: 1024 * 1024 * 20,
  });
}

const noopLogger = { warn: () => {}, info: () => {}, error: () => {} };

export async function loadPlaywrightFactory() {
  try {
    const { chromium } = await import('playwright');
    return async (launchOptions) => chromium.launch(launchOptions);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw error;
  }
}
