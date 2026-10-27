import { existsSync, readFileSync, writeFileSync, renameSync, realpathSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { jobAlive } from './agent-workspaces.mjs';

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const statePath = (root) => join(root, 'disk-scans.json');
const holderAlive = (holder) => jobAlive(holder, { identities: () => null });
function read(root) {
  const rows = existsSync(statePath(root)) ? JSON.parse(readFileSync(statePath(root), 'utf8')) : [];
  const uuid = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
  if (!Array.isArray(rows) || rows.length > 64 || rows.some((row) =>
    !row || !uuid(row.token) || row.path !== join(root, 'retired') ||
    !['active', 'complete', 'failed'].includes(row.state) || !Number.isInteger(row.workerPid) || row.workerPid < 1 ||
    !Number.isFinite(Date.parse(row.startedAt)) || !Array.isArray(row.holders) || row.holders.length > 1024 ||
    row.holders.some((holder) => !holder || !uuid(holder.token) || !Number.isInteger(holder.pid) || holder.pid < 1 || !Number.isFinite(Date.parse(holder.startedAt))) ||
    (row.state === 'complete' && (!Number.isSafeInteger(row.bytes) || row.bytes < 0)) ||
    (row.state === 'failed' && typeof row.error !== 'string')
  ) || new Set(rows.map((row) => row.token)).size !== rows.length || rows.filter((row) => row.state === 'active').length > 1) {
    throw new Error('Invalid retired disk scan ownership state.');
  }
  return rows;
}
function save(root, rows) {
  const temporary = `${statePath(root)}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(rows), { flag: 'wx', mode: 0o600 });
  renameSync(temporary, statePath(root));
}
function recover(rows) {
  for (const row of rows) {
    if (row.state === 'active' && !jobAlive({ pid: null, childPid: row.workerPid, startedAt: row.startedAt })) {
      row.state = 'failed'; row.error = 'Retired disk scan worker exited before publishing a complete measurement.';
    }
    row.holders = row.holders.filter(holderAlive);
  }
  return rows.filter((row) => row.state === 'active' || row.holders.length);
}

// A holder can consume only the generation it joined while it was active.
// Terminal rows outlive a worker only until those holders collect their result.
export async function coordinatedRetiredBytes(manager, target) {
  const root = realpathSync(manager.root);
  const path = join(root, 'retired');
  const entry = lstatSync(target);
  if (!entry.isDirectory() || entry.isSymbolicLink() || realpathSync(target) !== path) throw new Error(`Unsafe retired directory: ${target}`);
  const holder = { token: randomUUID(), pid: process.pid, startedAt: new Date().toISOString() };
  let worker;
  const token = await manager.locked(() => {
    const rows = recover(read(root));
    let row = rows.find((item) => item.path === path && item.state === 'active');
    if (!row) {
      if (rows.length >= 64) throw new Error('Too many outstanding retired disk scan generations.');
      row = { token: randomUUID(), path, startedAt: new Date().toISOString(), state: 'active', holders: [] };
      worker = spawn(process.execPath, [fileURLToPath(new URL('./disk-scan-worker.mjs', import.meta.url)), root, row.token], {
        detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      worker.on('error', () => {});
      if (!Number.isInteger(worker.pid)) throw new Error('Cannot start retired disk scan worker.');
      row.workerPid = worker.pid;
      rows.push(row);
    }
    if (row.holders.length >= 1024) throw new Error('Too many callers waiting for a retired disk scan.');
    row.holders.push(holder);
    save(root, rows);
    return row.token;
  });
  if (worker) {
    // The durable owner record precedes GO. A crash before GO leaves a worker
    // that times out without ever starting du, rather than an unowned pool.
    worker.send({ token }, () => { if (worker.connected) worker.disconnect(); });
    worker.unref();
  }
  const deadline = Date.now() + 200_000;
  let nextRecovery = Date.now() + 1_000;
  let primary;
  try {
    while (true) {
      const row = read(root).find((item) => item.token === token);
      if (!row) throw new Error('Retired disk scan generation disappeared before completion.');
      if (row.state === 'complete') return row.bytes;
      if (row.state === 'failed') throw new Error(row.error);
      if (Date.now() > deadline) throw new Error('Retired disk scan ownership remains active or unknown after 200000ms.');
      if (Date.now() >= nextRecovery) {
        await manager.locked(() => save(root, recover(read(root))));
        nextRecovery = Date.now() + 1_000;
      }
      await pause(60);
    }
  } catch (error) { primary = error; throw error; }
  finally {
    try {
      await manager.locked(() => {
        const rows = read(root);
        const row = rows.find((item) => item.token === token);
        if (row) row.holders = row.holders.filter((item) => item.token !== holder.token);
        save(root, rows.filter((item) => item.state === 'active' || item.holders.length));
      });
    } catch (cleanup) {
      if (primary) throw new AggregateError([primary, cleanup], `${primary.message}; cleanup also failed: ${cleanup.message}`, { cause: primary });
      throw cleanup;
    }
  }
}

export async function publishRetiredScan(manager, token, result) {
  const root = realpathSync(manager.root);
  await manager.locked(() => {
    const rows = read(root);
    const row = rows.find((item) => item.token === token && item.workerPid === process.pid && item.state === 'active');
    if (!row) throw new Error('Retired disk scan worker has no matching owner record.');
    Object.assign(row, result);
    row.holders = row.holders.filter(holderAlive);
    save(root, rows.filter((item) => item.state === 'active' || item.holders.length));
  });
}

export function ownedRetiredScan(root, token) {
  return read(root).find((row) => row.token === token && row.workerPid === process.pid && row.state === 'active');
}
