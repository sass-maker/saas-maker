import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ConcurrencyGate } from "./gate.mjs";
import { findChrome } from "./config.mjs";
import { TargetRunner } from "./runner.mjs";

export { UpstreamBlockedError } from "./http.mjs";

function integer(value, fallback, min, max, name) {
  const number = value ?? fallback;
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new TypeError(`${name} must be an integer between ${min} and ${max}`);
  }
  return number;
}

// Importing the package starts no service, reads no credentials and creates no
// files. Cache persistence and browser rendering are explicit consumer choices.
export function createCollector(options = {}) {
  const runner = new TargetRunner({
    chromeExecutable: options.chromeExecutable ?? findChrome(),
    profileDir: options.profileDir ?? join(tmpdir(), `saas-collect-${randomUUID()}`),
    httpCacheFile: options.cacheFile ?? null,
    headless: true,
    blockResources: true,
    locale: "en-US",
    timezoneId: "UTC",
    browserConcurrency: 1,
    httpConcurrency: integer(options.concurrency, 3, 1, 12, "concurrency"),
    httpTimeoutMs: integer(options.timeoutMs, 15_000, 1, 60_000, "timeoutMs"),
    httpRetries: integer(options.retries, 0, 0, 2, "retries"),
    httpRetryBaseMs: 500,
    maxResponseBytes: integer(options.maxResponseBytes, 2_000_000, 1, 10_000_000, "maxResponseBytes"),
    userAgent: options.userAgent ?? "@saas-maker/collect/0.3",
    validateUrl: options.validateUrl,
    navigationTimeoutMs: 30_000,
    minDelayMs: 30_000,
    jitterMs: 5_000,
    maxQueueSize: 50,
  });
  const gate = new ConcurrencyGate(runner.config.httpConcurrency);
  let started;
  let closed = false;
  async function collect(input) {
    if (closed) throw new Error("Collector is closed");
    const url = new URL(input.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new TypeError("Collection requires an HTTP(S) URL without credentials");
    }
    const extractor = input.extractor ?? "page";
    if (!["page", "jobs", "json", "text"].includes(extractor)) throw new TypeError("Unknown extractor");
    const transport = input.transport ?? (options.browserFallback ? "auto" : "http");
    if (!["http", "auto", "browser"].includes(transport)) throw new TypeError("Unknown transport");
    if (transport !== "http" && !options.browserFallback) throw new Error("Browser fallback is disabled");
    if (transport !== "http" && !runner.config.chromeExecutable) throw new Error("Google Chrome is required for browser fallback");
    started ??= runner.start();
    await started;
    return gate.run(() => runner.run({
      ...input, url: url.href, name: input.name ?? url.hostname, extractor, transport,
      ...(extractor === "jobs" ? { careersUrl: input.careersUrl ?? url.href } : {}),
    }));
  }
  return {
    collect,
    async collectMany(targets) {
      if (!Array.isArray(targets) || targets.length > 100) throw new TypeError("Use at most 100 targets per batch");
      return Promise.all(targets.map(async (target) => {
        try { return { status: "completed", target, result: await collect(target) }; }
        catch (error) {
          return { status: "error", target, error: { code: error.code ?? "collection_failed", message: error.message, status: error.status ?? null } };
        }
      }));
    },
    async close() {
      closed = true;
      if (started) await runner.close();
    },
  };
}
