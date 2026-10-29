import assert from "node:assert/strict";
import test from "node:test";
import { handleHostedRequest } from "../worker.js";
import { landingRows, publicCopy } from "../public-site.js";

const origin = "https://mcp.example";
const noUpstream: typeof fetch = async () => { throw new Error("Public documents must never fetch product data"); };
const request = (path: string, init?: RequestInit) => handleHostedRequest(new Request(origin + path, init), noUpstream);

test("public directory Markdown shares every visible endpoint, audience and availability", async () => {
  const html = await (await request("/")).text();
  const response = await request("/index.md");
  const markdown = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Location"), `${origin}/`);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, follow");
  assert.ok(markdown.includes(publicCopy.summary));
  assert.ok(html.includes('name="ai-summary"'));
  for (const row of landingRows()) {
    assert.ok(markdown.includes(row.name), row.name);
    assert.ok(markdown.includes(row.endpoint), row.endpoint);
    assert.ok(html.includes(row.endpoint), row.endpoint);
  }
  for (const path of ["/api/md/", "/"]) {
    const rendered = await request(path, { headers: { Accept: "text/markdown", Cookie: "PRIVATE_FIXTURE", Authorization: "PRIVATE_FIXTURE" } });
    assert.equal(await rendered.text(), markdown);
  }
  assert.ok(!markdown.includes("PRIVATE_FIXTURE"));
  for (const accept of ["*/*", "text/markdown;q=0", "text/markdown, text/html"]) {
    const rendered = await request("/", { headers: { Accept: accept } });
    assert.match(rendered.headers.get("Content-Type")!, /text\/html/);
  }
});

test("public HEAD, preflight and errors cannot expose private MCP content", async () => {
  for (const path of ["/", "/index.md", "/api/md/", "/llms.txt", "/llms-full.txt", "/ai.txt", "/api/md/_catalog", "/robots.txt", "/sitemap.xml"]) {
    const head = await request(path, { method: "HEAD" });
    assert.equal(head.status, 200, path);
    assert.equal(await head.text(), "", path);
  }
  const options = await request("/api/md/", { method: "OPTIONS" });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Origin"), "*");
  for (const path of ["/missing.md", "/api/md/personal-apps/mcp", "/api/md/dashboard"]) {
    const missing = await request(path);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("Content-Type"), "text/markdown; charset=utf-8");
  }
  // The existing MCP method boundary remains in charge of actual endpoints.
  assert.equal((await request("/reader/mcp")).status, 405);
  const robots = await (await request("/robots.txt")).text();
  for (const bot of ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider"]) assert.ok(robots.includes(`User-agent: ${bot}\nAllow: /`));
  assert.ok(robots.includes("Disallow: /personal-apps/mcp"));
  const catalog = await (await request("/api/md/_catalog")).json() as { path: string }[];
  assert.deepEqual(catalog.map((route) => route.path), ["/"]);
});


test("authored landing narrative stays present in Markdown", async () => {
  const html = await (await request("/")).text();
  const markdown = await (await request("/index.md")).text();
  const words = (value: string) => value.replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const normalizedMarkdown = words(markdown);
  const patterns = [
    /<h1 id="hero-title">([\s\S]*?)<\/h1>/,
    /<p class="bubble">([\s\S]*?)<\/p>/,
    /<span class="wire-cap">([\s\S]*?)<\/span>/,
    /<div class="lane"><b>Public<\/b>([\s\S]*?)<\/div>/,
    /<div class="lane"><b>Owner sign-in<\/b>([\s\S]*?)<\/div>/,
    /<div class="dir-head">[\s\S]*?<\/div>\s*<p>([\s\S]*?)<\/p>/,
    /<h2 id="boundary-title">([\s\S]*?)<\/h2>/,
  ];
  for (const pattern of patterns) {
    const authored = html.match(pattern)?.[1];
    assert.ok(authored, `Authored HTML section missing: ${pattern}`);
    assert.ok(normalizedMarkdown.includes(words(authored)), `Markdown omitted authored copy: ${authored}`);
  }
});
