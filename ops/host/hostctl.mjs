#!/usr/bin/env node

import {
  HostFoundationError,
  doctor,
  dryRun,
  pause,
  promote,
  renderSchedule,
  resume,
  revoke,
  status,
} from './foundation.mjs';

const COMMANDS = new Set(['doctor', 'render', 'dry-run', 'promote', 'pause', 'resume', 'revoke', 'status']);
const OPTION_KEYS = new Set(['role-file', 'now', 'ttl-seconds']);

function usage() {
  return `usage: node ops/host/hostctl.mjs <command> [options]

Commands:
  doctor    Check local prerequisites without writing files.
  render    Render schedule intent to the injected output path; never install it.
  dry-run   Report whether this host could become primary; never write files.
  promote   Acquire an absent or expired primary lease.
  pause     Make the configured host's lease unhealthy without revoking it.
  resume    Reacquire the configured host's paused or expired lease.
  revoke    Revoke the configured host's lease.
  status    Read sanitized local lease status.

Options:
  --role-file <absolute-path>  Explicit machine-local role file.
  --now <ISO-8601>             Fixture/testing clock override.
  --ttl-seconds <1..86400>     Lease duration for promote/resume (default: 900).
`;
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new HostFoundationError('USAGE', 'Every option requires an explicit value.');
    }
    const key = flag.slice(2);
    if (!OPTION_KEYS.has(key) || Object.hasOwn(options, key)) {
      throw new HostFoundationError('USAGE', 'An option is unknown or duplicated.');
    }
    options[key] = value;
  }
  return {
    roleFile: options['role-file'],
    now: options.now,
    ttlSeconds: options['ttl-seconds'],
  };
}

function print(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

const [command, ...rawOptions] = process.argv.slice(2);
if (command === '--help' || command === '-h' || command === 'help') {
  process.stdout.write(usage());
  process.exit(0);
}
if (!COMMANDS.has(command)) {
  print({ schemaVersion: 1, ok: false, error: 'USAGE', message: 'An explicit host command is required.' }, process.stderr);
  process.exit(2);
}

try {
  const options = parseOptions(rawOptions);
  let result;
  switch (command) {
    case 'doctor': result = doctor(options.roleFile); break;
    case 'render': result = renderSchedule(options.roleFile, options); break;
    case 'dry-run': result = dryRun(options.roleFile, options); break;
    case 'promote': result = promote(options.roleFile, options); break;
    case 'pause': result = pause(options.roleFile, options); break;
    case 'resume': result = resume(options.roleFile, options); break;
    case 'revoke': result = revoke(options.roleFile, options); break;
    case 'status': result = status(options.roleFile, options); break;
  }
  print(result);
  if (result.ok === false) process.exitCode = 1;
} catch (error) {
  const known = error instanceof HostFoundationError;
  print({
    schemaVersion: 1,
    ok: false,
    error: known ? error.code : 'HOST_FOUNDATION_ERROR',
    message: known ? error.message : 'The host operation failed safely.',
  }, process.stderr);
  process.exitCode = known && error.code === 'USAGE' ? 2 : 1;
}
