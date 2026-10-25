import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCollector, UrlPolicyDeniedError } from "@saas-maker/collect";
import { HttpCache } from "../src/http-cache.mjs";
import { HttpScraper } from "../src/http.mjs";
import { TargetRunner } from "../src/runner.mjs";
import { Scraper } from "../src/scraper.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function serverFor(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
async function directoryFor(t) {
  const directory = await mkdtemp(join(tmpdir(), "collect-safety-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("URL denial retains its typed code, is not retried and never opens a browser", async (t) => {
  let requests = 0;
  let checks = 0;
  let browserStarts = 0;
  t.mock.method(TargetRunner.prototype, "run", async () => { browserStarts++; });
  const base = await serverFor(t, (req, res) => { requests++; res.end("unexpected"); });
  const collector = createCollector({ retries: 2, browserFallback: true, chromeExecutable: "/unused", validateUrl() { checks++; throw new Error("Destination denied"); } });
  t.after(() => collector.close());
  await assert.rejects(collector.collect({ url: base, transport: "http" }), (error) => error instanceof UrlPolicyDeniedError && error.code === "url_policy_denied");
  for (const transport of ["auto", "browser"]) await assert.rejects(collector.collect({ url: base, transport }), /URL policy requires HTTP/);
  assert.equal(checks, 1);
  assert.equal(requests, 0);
  assert.equal(browserStarts, 0);
});

test("redirect and careers URL denials remain nonretryable per-target policy errors", async (t) => {
  let redirects = 0;
  let privateRequests = 0;
  let denials = 0;
  const base = await serverFor(t, (req, res) => {
    if (req.url === "/redirect") { redirects++; res.writeHead(302, { location: "/private" }).end(); }
    else { privateRequests++; res.end("unexpected"); }
  });
  const collector = createCollector({ retries: 2, validateUrl(url) { if (url.endsWith("/private")) { denials++; throw new Error("Destination denied"); } } });
  t.after(() => collector.close());
  const results = await collector.collectMany([
    { url: `${base}/redirect`, extractor: "text" },
    { url: base, careersUrl: `${base}/private`, extractor: "jobs" },
  ]);
  assert.deepEqual(results.map((result) => result.error.code), ["url_policy_denied", "url_policy_denied"]);
  assert.equal(redirects, 1);
  assert.equal(privateRequests, 0);
  assert.equal(denials, 2);
  await assert.rejects(collector.collect({ url: base, careersUrl: "file:///private", extractor: "jobs" }), /HTTP\(S\) careers/);
});

test("JSON and text default to HTTP even with browser fallback and refuse other transports", async (t) => {
  const base = await serverFor(t, (req, res) => { res.setHeader("content-type", "application/json"); res.end('{"value":7}'); });
  const collector = createCollector({ browserFallback: true, chromeExecutable: "/unused" });
  t.after(() => collector.close());
  for (const extractor of ["json", "text"]) {
    const result = await collector.collect({ url: base, extractor });
    assert.equal(result.transport, "http");
    for (const transport of ["auto", "browser"]) await assert.rejects(collector.collect({ url: base, extractor, transport }), /require HTTP/);
  }
});

test("401, 403 and 429 stop after one request without browser fallback", async (t) => {
  const requests = new Map();
  const base = await serverFor(t, (req, res) => {
    const status = Number(req.url.slice(1));
    requests.set(status, (requests.get(status) ?? 0) + 1);
    res.writeHead(status).end("Unavailable");
  });
  const collector = createCollector({ retries: 2, browserFallback: true, chromeExecutable: "/unused" });
  t.after(() => collector.close());
  for (const status of [401, 403, 429]) {
    await assert.rejects(collector.collect({ url: `${base}/${status}` }), (error) => error.code === "upstream_blocked" && error.status === status);
    assert.equal(requests.get(status), 1);
  }
});

test("one attempt deadline covers all policy-checked redirect hops", async (t) => {
  let requests = 0;
  const base = await serverFor(t, (req, res) => {
    requests++;
    setTimeout(() => res.writeHead(302, { location: `/${requests}` }).end(), 80);
  });
  const collector = createCollector({ timeoutMs: 120, retries: 0, validateUrl() {} });
  t.after(() => collector.close());
  const started = Date.now();
  await assert.rejects(collector.collect({ url: base, extractor: "text" }), /HTTP transport failed/);
  assert.ok(Date.now() - started < 350, "redirects reset the attempt deadline");
  assert.ok(requests <= 2, "additional redirect requests escaped the deadline");
});

test("a declared oversized response cancels its body before failing", async (t) => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  t.mock.method(globalThis, "fetch", async () => new Response(body, { headers: { "content-length": "100" } }));
  const scraper = new HttpScraper({ httpTimeoutMs: 1_000, maxResponseBytes: 10 }, new HttpCache());
  await assert.rejects(scraper.scrape({ url: "https://example.test", extractor: "text" }), /exceeds 10 bytes/);
  assert.equal(cancelled, true);
});

test("cache evicts least recently used entries within entry and serialized-byte budgets", async () => {
  const cache = new HttpCache(null, { maxEntries: 2, maxBytes: 100 });
  cache.set("first", { text: "one" });
  cache.set("second", { text: "two" });
  assert.equal(cache.get("first").text, "one");
  cache.set("third", { text: "three" });
  assert.equal(cache.get("second"), undefined);
  cache.set("huge", { text: "x".repeat(100) });
  assert.equal(cache.get("huge"), undefined);
  assert.equal(cache.entries.size, 2);
  assert.ok(cache.bytes <= 100);
  cache.set("first", { text: "y".repeat(65) });
  assert.ok(cache.bytes <= 100);
});

test("persisted cache loading and saving obey the same bounds and skip oversized files", async (t) => {
  const directory = await directoryFor(t);
  const path = join(directory, "cache.json");
  await writeFile(path, JSON.stringify({ entries: { first: { text: "one" }, second: { text: "two" }, third: { text: "three" } } }));
  const cache = await new HttpCache(path, { maxEntries: 2, maxBytes: 100 }).load();
  assert.equal(cache.entries.size, 2);
  assert.equal(cache.get("first"), undefined);
  await cache.save();
  assert.deepEqual(Object.keys(JSON.parse(await readFile(path, "utf8")).entries), ["second", "third"]);
  await writeFile(path, "x".repeat(2_000));
  const oversized = await new HttpCache(path, { maxEntries: 2, maxBytes: 100 }).load();
  assert.equal(oversized.entries.size, 0);
  assert.equal(oversized.bytes, 0);
});

test("close waits for active collection, rejects queued work and persists the completed result", async (t) => {
  const directory = await directoryFor(t);
  const cacheFile = join(directory, "cache.json");
  let finishResponse;
  let admitted;
  const active = new Promise((resolve) => { admitted = resolve; });
  let requests = 0;
  const base = await serverFor(t, (req, res) => { requests++; finishResponse = () => res.end("collected"); admitted(); });
  const collector = createCollector({ concurrency: 1, cacheFile });
  const first = collector.collect({ url: `${base}/first`, extractor: "text" });
  const queued = collector.collect({ url: `${base}/queued`, extractor: "text" });
  const queuedRejected = assert.rejects(queued, /closed/);
  await active;
  let closed = false;
  const closing = collector.close().then(() => { closed = true; });
  await sleep(30);
  assert.equal(closed, false);
  await assert.rejects(collector.collect({ url: base }), /closed/);
  finishResponse();
  assert.equal((await first).text, "collected");
  await Promise.all([closing, queuedRejected]);
  assert.equal(requests, 1);
  assert.equal(Object.keys(JSON.parse(await readFile(cacheFile, "utf8")).entries).length, 1);
  await collector.close();
});

test("close prevents queued browser starts and deletes only SDK-generated profiles", async (t) => {
  let firstStarted;
  const active = new Promise((resolve) => { firstStarted = resolve; });
  let finish;
  const completion = new Promise((resolve) => { finish = resolve; });
  let runs = 0;
  let generatedProfile;
  t.mock.method(Scraper.prototype, "scrapePage", async function () {
    runs++;
    generatedProfile = this.config.profileDir;
    await mkdir(generatedProfile, { recursive: true });
    await writeFile(join(generatedProfile, "cookie"), "owned");
    firstStarted();
    await completion;
    return { transport: "browser" };
  });
  const collector = createCollector({ concurrency: 3, browserFallback: true, chromeExecutable: "/unused" });
  const first = collector.collect({ url: "https://example.test/first", transport: "browser" });
  const queued = assert.rejects(collector.collect({ url: "https://example.test/queued", transport: "browser" }), /closed/);
  await active;
  const closing = collector.close();
  finish();
  await Promise.all([first, queued, closing]);
  assert.equal(runs, 1);
  await assert.rejects(readFile(join(generatedProfile, "cookie")), { code: "ENOENT" });
  const callerProfile = await directoryFor(t);
  await writeFile(join(callerProfile, "cookie"), "caller");
  const caller = createCollector({ profileDir: callerProfile });
  await caller.close();
  assert.equal(await readFile(join(callerProfile, "cookie"), "utf8"), "caller");
});
