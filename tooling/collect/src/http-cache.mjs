import { mkdir, open, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class HttpCache {
  constructor(path, { maxEntries = 128, maxBytes = 16_000_000 } = {}) {
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
      throw new TypeError("Cache limits must be positive safe integers");
    }
    this.path = path;
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.bytes = 0;
    this.entries = new Map();
    this.dirty = false;
  }

  async load() {
    if (!this.path) return this;
    let file;
    try {
      file = await open(this.path, "r");
      const { size } = await file.stat();
      if (size > this.maxBytes + 1_024) { this.dirty = true; return this; }
      const buffer = Buffer.alloc(size + 1);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead > size) { this.dirty = true; return this; }
      const parsed = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
      for (const [url, entry] of Object.entries(parsed.entries || {})) this.set(url, entry);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    } finally { await file?.close(); }
    return this;
  }

  get(url) {
    const cached = this.entries.get(url);
    if (!cached) return undefined;
    this.entries.delete(url);
    this.entries.set(url, cached);
    this.dirty = true;
    return cached.entry;
  }

  set(url, entry) {
    const bytes = Buffer.byteLength(JSON.stringify([url, entry]));
    const previous = this.entries.get(url);
    if (previous) { this.bytes -= previous.bytes; this.entries.delete(url); }
    if (bytes <= this.maxBytes) {
      this.entries.set(url, { entry, bytes });
      this.bytes += bytes;
    }
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const [oldest, cached] = this.entries.entries().next().value;
      this.entries.delete(oldest);
      this.bytes -= cached.bytes;
    }
    this.dirty = true;
  }

  conditionalHeaders(url) {
    const entry = this.get(url);
    return {
      ...(entry?.etag ? { "if-none-match": entry.etag } : {}),
      ...(entry?.lastModified ? { "if-modified-since": entry.lastModified } : {}),
    };
  }

  async save() {
    if (!this.path) return;
    if (!this.dirty) return;
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    const entries = Object.fromEntries([...this.entries].map(([url, { entry }]) => [url, entry]));
    await writeFile(temporary, `${JSON.stringify({ version: 1, entries })}\n`);
    await rename(temporary, this.path);
    this.dirty = false;
  }
}
