import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ROOT = path.join(process.env.HOME ?? '.', 'Library/Application Support/Fleet Ops/marketing-publications');

export class FilePublicationLedger {
  constructor(options = {}) {
    this.root = path.resolve(options.root ?? process.env.MARKETING_PUBLICATION_LEDGER ?? DEFAULT_ROOT);
    this.now = options.now ?? (() => new Date());
  }

  async claim(idempotencyKey) {
    await mkdir(this.root, { recursive: true });
    const target = this.pathFor(idempotencyKey);
    const record = { schema: 'fleet.publication-ledger.v1', idempotencyKey, state: 'inflight', claimedAt: this.now().toISOString(), updatedAt: this.now().toISOString() };
    try {
      const handle = await open(target, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`);
      await handle.close();
      return { claimed: true, record };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = JSON.parse(await readFile(target, 'utf8'));
      return { claimed: false, record: existing };
    }
  }

  async complete(idempotencyKey, receipt) {
    return this.write(idempotencyKey, { state: 'completed', receipt, completedAt: this.now().toISOString() });
  }

  async retry(idempotencyKey, failure, nextAttemptAt) {
    return this.write(idempotencyKey, { state: 'retry_wait', failure, nextAttemptAt });
  }

  async fail(idempotencyKey, failure) {
    return this.write(idempotencyKey, { state: 'failed', failure });
  }

  async releaseRetry(idempotencyKey) {
    const target = this.pathFor(idempotencyKey);
    const existing = JSON.parse(await readFile(target, 'utf8'));
    if (existing.state !== 'retry_wait') return { released: false, record: existing };
    await this.write(idempotencyKey, { state: 'inflight', claimedAt: this.now().toISOString() });
    return { released: true };
  }

  async write(idempotencyKey, patch) {
    await mkdir(this.root, { recursive: true });
    const target = this.pathFor(idempotencyKey);
    let existing = {};
    try { existing = JSON.parse(await readFile(target, 'utf8')); } catch {}
    const record = { schema: 'fleet.publication-ledger.v1', idempotencyKey, ...existing, ...patch, updatedAt: this.now().toISOString() };
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, target);
    return record;
  }

  pathFor(idempotencyKey) {
    if (!/^[a-f0-9]{64}$/.test(idempotencyKey)) throw new Error('invalid publication idempotency key');
    return path.join(this.root, `${idempotencyKey}.json`);
  }
}
