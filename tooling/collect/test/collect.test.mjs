import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createCollector, UpstreamBlockedError } from "@saas-maker/collect";

test("package API collects pages/JSON, keeps partial failures and stops at a blocked source", async () => {
  let blockedRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/blocked") {
      blockedRequests++;
      response.writeHead(429).end("Try later");
    } else if (request.url === "/json") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ hits: [{ id: 7 }] }));
    } else {
      response.setHeader("content-type", "text/html");
      response.end("<html><title>Public research</title><body><h1>Evidence</h1><p>Useful public information extracted as structured text, headings and source links without launching Chrome.</p><a href='/source'>Source</a></body></html>");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const collector = createCollector({ retries: 2, timeoutMs: 2000 });
  try {
    const results = await collector.collectMany([
      { url: base, extractor: "page" },
      { url: `${base}/json`, extractor: "json" },
      { url: `${base}/blocked`, extractor: "page" },
    ]);
    assert.equal(results[0].result.data.title, "Public research");
    assert.equal(results[0].result.transport, "http");
    assert.deepEqual(results[1].result.data, { hits: [{ id: 7 }] });
    assert.equal(results[2].error.code, "upstream_blocked");
    assert.equal(results[2].error.status, 429);
    assert.equal(blockedRequests, 1);
    await assert.rejects(collector.collect({ url: `${base}/blocked`, transport: "auto" }), /Browser fallback is disabled/);
    await assert.rejects(collector.collect({ url: "file:///private" }), /HTTP/);
    assert.equal(UpstreamBlockedError.name, "UpstreamBlockedError");
  } finally {
    await collector.close();
    await new Promise((resolve) => server.close(resolve));
  }
  await assert.rejects(collector.collect({ url: base }), /closed/);
});

test("consumer URL policy checks redirect destinations before fetching them", async () => {
  let destinationRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/redirect") response.writeHead(302, { location: "/private" }).end();
    else { destinationRequests++; response.end("private"); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const collector = createCollector({
    validateUrl(url) { if (url.endsWith("/private")) throw new Error("Destination denied"); },
  });
  try {
    await assert.rejects(collector.collect({ url: `${base}/redirect`, extractor: "text" }), /Destination denied/);
    assert.equal(destinationRequests, 0);
  } finally {
    await collector.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
