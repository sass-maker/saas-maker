import { spawnSync } from 'node:child_process';

const checks = [
  commandCheck('node', ['--version']),
  commandCheck('uv', ['--version']),
  commandCheck('ffmpeg', ['-version'], { firstLineOnly: true }),
  commandCheck('docker', ['info', '--format', '{{.ServerVersion}}']),
  uvDryRun(),
];

let failed = false;
for (const check of checks) {
  if (!check.ok) failed = true;
  console.log(`${check.ok ? 'ok' : 'fail'} ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
}

if (failed) process.exit(1);

function commandCheck(name, args, options = {}) {
  const result = spawnSync(name, args, { encoding: 'utf8' });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return {
    name,
    ok: result.status === 0,
    detail: options.firstLineOnly ? output.split('\n')[0] : output.split('\n').slice(0, 2).join(' '),
  };
}

function uvDryRun() {
  const result = spawnSync('uv', ['sync', '--frozen', '--dry-run'], {
      cwd: 'engines/MoneyPrinterTurbo',
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  if (result.status !== 0) {
    return {
      name: 'MoneyPrinterTurbo uv dry-run',
      ok: false,
      detail: output.trim(),
    };
  }
  const installMatch = output.match(/Would install (\d+) packages/);
  const downloadMatch = output.match(/Would download (\d+) packages/);
  return {
    name: 'MoneyPrinterTurbo uv dry-run',
    ok: true,
    detail: `${installMatch?.[1] ?? '?'} installs, ${downloadMatch?.[1] ?? '?'} downloads`,
  };
}
