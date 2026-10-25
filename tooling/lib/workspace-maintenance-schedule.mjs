import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync, realpathSync, lstatSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export const maintenanceLabel = 'com.sarthak.fleet-workspace-maintenance';
const xml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function maintenancePlist({ node, cli, root, path }) {
  if (![node, cli, root].every(isAbsolute)) throw new Error('Schedule requires absolute executable, CLI and state paths.');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${maintenanceLabel}</string>
<key>ProgramArguments</key><array>
${[node, cli, 'maintain', '--root', root, '--apply'].map((value) => '<string>' + xml(value) + '</string>').join('\n')}
</array>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(path)}</string></dict>
<key>StartInterval</key><integer>3600</integer>
<key>RunAtLoad</key><false/>
<key>ProcessType</key><string>Background</string>
<key>StandardOutPath</key><string>/dev/null</string>
<key>StandardErrorPath</key><string>/dev/null</string>
</dict></plist>
`;
}

export function installMaintenanceSchedule({ root, cli, apply = false }, {
  home = homedir(),
  node = ['/opt/homebrew/bin/node', '/usr/local/bin/node'].find((path) => existsSync(path) && realpathSync(path) === process.execPath) ?? process.execPath,
  platform = process.platform,
  path = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
  uid = process.getuid?.(), run = spawnSync,
} = {}) {
  if (platform !== 'darwin') throw new Error('The maintenance scheduler uses macOS launchd; run maintain from your scheduler on other platforms.');
  cli = cli instanceof URL ? fileURLToPath(cli) : cli;
  if (apply && ['worktrees', 'retired'].some((name) => cli.startsWith(join(root, name) + sep))) throw new Error('Install the schedule from a durable CLI release, not a disposable worktree.');
  const plist = maintenancePlist({ node, cli, root, path });
  const plistPath = join(home, 'Library', 'LaunchAgents', maintenanceLabel + '.plist');
  const domain = 'gui/' + uid;
  if (existsSync(plistPath) && (!lstatSync(plistPath).isFile() || lstatSync(plistPath).isSymbolicLink())) throw new Error('Keep the non-regular schedule path for review.');
  const previous = existsSync(plistPath) ? readFileSync(plistPath, 'utf8') : null;
  if (previous && !previous.includes('<string>' + maintenanceLabel + '</string>')) throw new Error('An unrelated schedule occupies this path; keep it for review.');
  const result = { installed: false, plistPath, intervalSeconds: 3600, idleMinutes: 1440, resultPath: join(root, 'storage-maintenance.json'), plist };
  if (!apply) return result;
  mkdirSync(join(home, 'Library', 'LaunchAgents'), { recursive: true });
  // One rollback copy and one overwritten result; the scheduler creates no log archive.
  if (previous) copyFileSync(plistPath, join(root, 'maintenance-schedule.previous.plist'));
  const temporary = plistPath + '.' + randomUUID() + '.fleet-tmp';
  writeFileSync(temporary, plist, { mode: 0o600, flag: 'wx' });
  const checked = run('/usr/bin/plutil', ['-lint', temporary], { encoding: 'utf8' });
  if (checked.error || checked.status !== 0) throw new Error('Generated maintenance plist failed plutil validation.');
  run('/bin/launchctl', ['bootout', domain + '/' + maintenanceLabel], { encoding: 'utf8' });
  renameSync(temporary, plistPath);
  const started = run('/bin/launchctl', ['bootstrap', domain, plistPath], { encoding: 'utf8' });
  if (started.error || started.status !== 0) {
    if (previous) {
      writeFileSync(plistPath, previous, { mode: 0o600 });
      run('/bin/launchctl', ['bootstrap', domain, plistPath], { encoding: 'utf8' });
    }
    throw new Error('launchd did not accept the maintenance schedule; inspect the local plist.');
  }
  return { ...result, installed: true };
}
