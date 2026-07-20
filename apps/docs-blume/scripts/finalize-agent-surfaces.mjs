import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageRoot, '../..');
const screenshotSource = resolve(repoRoot, 'docs/screenshots/app-health');
const screenshotOutput = resolve(packageRoot, 'dist/screenshots/app-health');

await mkdir(screenshotOutput, { recursive: true });
for (const filename of ['app-health-desktop.jpg', 'app-health-mobile.jpg']) {
  await copyFile(resolve(screenshotSource, filename), resolve(screenshotOutput, filename));
}

const llmsPath = resolve(packageRoot, 'dist/llms.txt');
const manifestLine =
  '- [App Health install manifest](https://packages.sassmaker.com/app-health/install.json): Machine-readable runtime, privacy, and verification contract.';
const llms = await readFile(llmsPath, 'utf8');
if (!llms.includes(manifestLine)) {
  await writeFile(llmsPath, `${llms.trimEnd()}\n${manifestLine}\n`);
}
