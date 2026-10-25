import test from "node:test";
import assert from "node:assert/strict";
import { createAppleCollector, normalizeAppleQuery, appleSourceUrl, parseAppleAppId, AppleCollectionError } from "@saas-maker/collect/apple";
const at = "2026-10-25T10:00:00.000Z";
const input = { term: "Ｔａｓｋ   管理", country: "US", platform: "ios", limit: 20 };
const app = { trackId: 123, trackName: "Task 管理", artistName: "Example", trackViewUrl: "https://apps.apple.com/us/app/example/id123", artworkUrl100: "https://is1-ssl.mzstatic.com/icon.png", description: "A task list", primaryGenreName: "Productivity", averageUserRating: 0, userRatingCount: 0, formattedPrice: "Free", version: "1", kind: "software" };
const response = (results = [app]) => Response.json({ resultCount: results.length, results });
const options = (extra = {}) => ({ reserve() {}, now: () => at, fetchImpl: async () => response(), ...extra });

test("Apple package subpath normalizes exact query/source parameters and preserves zero metadata", async () => {
  const events = [];
  const collector = createAppleCollector(options({ reserve({ query, sourceUrl }) { events.push(["reserved", query, sourceUrl]); }, fetchImpl: async (sourceUrl, request) => { events.push(["fetch", sourceUrl]); assert.equal(request.redirect, "manual"); assert.deepEqual(request.headers, { accept: "application/json" }); return response(); } }));
  const capture = await collector.search(input);
  assert.deepEqual(capture.key, { term: "task 管理", country: "us", platform: "ios", limit: 20 });
  assert.equal(capture.sourceUrl, "https://itunes.apple.com/search?term=task+%E7%AE%A1%E7%90%86&country=us&media=software&entity=software&limit=20");
  assert.equal(events[0][0], "reserved"); assert.equal(events[1][0], "fetch");
  assert.equal(capture.fetchedAt, at); assert.ok(capture.id); assert.equal(capture.apps[0].rating, 0); assert.equal(capture.apps[0].ratings, 0);
  assert.equal(capture.observation, undefined); assert.ok(Object.isFrozen(capture)); assert.ok(Object.isFrozen(capture.apps)); assert.ok(Object.isFrozen(capture.apps[0]));
  assert.throws(() => { capture.apps[0].name = "Changed"; }, TypeError);
});
test("Apple URL/ID lookup is allowlisted and query inputs cannot become SSRF destinations", async () => {
  assert.equal(parseAppleAppId("https://apps.apple.com/us/app/example/id123?mt=12"), "123"); assert.equal(parseAppleAppId(123), "123");
  for (const value of ["https://apps.apple.com.evil.test/id123", "https://apps.apple.com@evil.test/id123", "https://apps.apple.com:444/id123", "http://apps.apple.com/id123", "file:///id123", "https://itunes.apple.com/lookup?id=123", 0, -1, 1e16]) assert.equal(parseAppleAppId(value), null);
  let calls = 0; const collector = createAppleCollector(options({ fetchImpl: async () => { calls++; return response(); } }));
  await assert.rejects(collector.search({ ...input, limit: 201 }), e => e.code === "invalid_query" && e.status === 400);
  await assert.rejects(collector.search({ ...input, url: "https://private.test" }), /Unknown Apple query field/);
  await assert.rejects(collector.lookup({ id: "https://evil.test/id123", country: "us", platform: "ios" }), /Lookup requires/);
  assert.equal(calls, 0); assert.throws(() => createAppleCollector(), /reservation callback/);
});
test("Mac entity is explicit and an iOS direct-ID mismatch retains its own source/time instead of wrong app", async () => {
  const collector = createAppleCollector(options());
  const result = await collector.lookup({ id: "https://apps.apple.com/us/app/example/id123", country: "de", platform: "mac" });
  assert.equal(result.match, "platform-mismatch"); assert.deepEqual(result.apps, []); assert.match(result.notice, /another platform/); assert.equal(result.fetchedAt, at); assert.equal(result.sourceUrl, "https://itunes.apple.com/lookup?id=123&country=de&entity=macSoftware");
  const found = await collector.lookup({ id: 123, country: "us", platform: "ios" }); assert.equal(found.match, "matched"); assert.equal(found.apps[0].id, "123");
  const empty = await createAppleCollector(options({ fetchImpl: async () => response([]) })).lookup({ id: 123, country: "us", platform: "ios" }); assert.equal(empty.match, "not-found"); assert.equal(empty.notice, undefined);
});
test("mixed-platform search rejects a capture rather than shifting observed positions", async () => {
  await assert.rejects(createAppleCollector(options({ fetchImpl: async () => response([app, { ...app, trackId: 124, kind: "mac-software" }]) })).search(input), e => e.code === "platform_mismatch");
});
test("empty successful search stays an observed empty capture; invalid schemas never produce evidence", async () => {
  const empty = await createAppleCollector(options({ fetchImpl: async () => response([]) })).search(input); assert.equal(empty.kind, "search"); assert.deepEqual(empty.apps, []); assert.ok(empty.id);
  for (const payload of [{ resultCount: 2, results: [app] }, { resultCount: 1, results: [{ ...app, trackViewUrl: "javascript:alert(1)" }] }, { resultCount: 2, results: [app, app] }]) {
    await assert.rejects(createAppleCollector(options({ fetchImpl: async () => Response.json(payload) })).search(input), e => e.code === "provider_shape");
  }
  await assert.rejects(createAppleCollector(options({ fetchImpl: async () => response([{ ...app, trackId: 456 }]) })).lookup({ id: 123, country: "us", platform: "ios" }), /inconsistent app identities/);
});
test("unknown rating metadata stays null and unsafe artwork is omitted", async () => {
  const capture = await createAppleCollector(options({ fetchImpl: async () => response([{ ...app, averageUserRating: undefined, userRatingCount: -1, artworkUrl100: "https://evil.test/icon" }]) })).search(input);
  assert.equal(capture.apps[0].rating, null); assert.equal(capture.apps[0].ratings, null); assert.equal(capture.apps[0].icon, undefined);
});
test("reservation is required before every request, failures propagate without fetch or hidden retries", async () => {
  let calls = 0; const denied = Object.assign(new Error("paced"), { status: 429, retryAfter: 4 });
  const collector = createAppleCollector(options({ reserve() { throw denied; }, fetchImpl: async () => { calls++; return response(); } }));
  await assert.rejects(collector.search(input), e => e === denied); assert.equal(calls, 0);
  let reservations = 0; const repeated = createAppleCollector(options({ reserve() { reservations++; } })); await repeated.search(input); await repeated.search(input); assert.equal(reservations, 2);
});
test("Apple HTTP429 Retry-After is exposed unchanged and no internal retry spends another reservation", async () => {
  let requests = 0, reservations = 0;
  const collector = createAppleCollector(options({ reserve() { reservations++; }, fetchImpl: async () => { requests++; return new Response("wait", { status: 429, headers: { "retry-after": "600" } }); } }));
  await assert.rejects(collector.search(input), e => e instanceof AppleCollectionError && e.status === 429 && e.retryAfter === 600 && e.code === "upstream_http"); assert.equal(requests, 1); assert.equal(reservations, 1);
});
test("HTTP redirects are never followed to other hosts", async () => {
  let requests = 0;
  await assert.rejects(createAppleCollector(options({ fetchImpl: async () => { requests++; return new Response(null, { status: 302, headers: { location: "https://private.test/" } }); } })).search(input), e => e.code === "redirect_denied"); assert.equal(requests, 1);
});
test("actual streamed bytes and declared size enforce the2MB response cap", async () => {
  for (const make of [() => new Response("", { headers: { "content-length": "2000001" } }), () => new Response("x".repeat(2_000_001))]) {
    await assert.rejects(createAppleCollector(options({ fetchImpl: async () => make() })).search(input), e => e.code === "response_too_large");
  }
});
test("cancellation while waiting for reservation settles promptly without a provider call", async () => {
  const controller = new AbortController(); let calls = 0;
  const collector = createAppleCollector(options({ reserve() { controller.abort(); return new Promise(() => {}); }, fetchImpl: async () => { calls++; return response(); } }));
  await assert.rejects(collector.search(input, { signal: controller.signal }), e => e.code === "cancelled"); assert.equal(calls, 0);
});
test("network and response-body timeouts are bounded independently of injected fetch behavior", async () => {
  const collector = createAppleCollector(options({ timeoutMs: 5, fetchImpl: async () => { await new Promise(resolve => setTimeout(resolve, 30)); return response(); } }));
  await assert.rejects(collector.search(input), e => e.code === "timeout" && e.status === 504);
  let cancelled = false;
  const streamed = createAppleCollector(options({ timeoutMs: 5, fetchImpl: async () => new Response(new ReadableStream({ async pull() { await new Promise(resolve => setTimeout(resolve, 30)); }, cancel() { cancelled = true; } })) }));
  await assert.rejects(streamed.search(input), e => e.code === "timeout"); assert.equal(cancelled, true);
});
test("caller abort during fetch is a cancellation rather than a fabricated empty capture", async () => {
  const controller = new AbortController();
  await assert.rejects(createAppleCollector(options({ fetchImpl: async () => { controller.abort(); await new Promise(resolve => setTimeout(resolve, 20)); return response(); } })).search(input, { signal: controller.signal }), e => e.code === "cancelled");
});
test("query and cache identity include country/platform/coverage with original capture time", async () => {
  const a = normalizeAppleQuery({ kind: "search", ...input }); const b = normalizeAppleQuery({ ...a, limit: 50 }); assert.notEqual(appleSourceUrl(a), appleSourceUrl(b));
  const original = await createAppleCollector(options()).search(input); const cache = JSON.parse(JSON.stringify(original)); assert.equal(cache.fetchedAt, at); assert.equal(cache.id, original.id); assert.equal(cache.apps.length, 1); assert.equal(cache.observation, undefined);
});

test("native-style response-body aborts and stream errors preserve typed collection errors", async () => {
  const nativeBody = createAppleCollector(options({ timeoutMs: 5, fetchImpl: async (_url, { signal }) => new Response(new ReadableStream({ start(stream) { signal.addEventListener("abort", () => stream.error(new DOMException("Aborted", "AbortError")), { once: true }); }, async pull() { await new Promise(resolve => setTimeout(resolve, 30)); } })) }));
  await assert.rejects(nativeBody.search(input), e => e instanceof AppleCollectionError && e.code === "timeout");
  const failedBody = createAppleCollector(options({ fetchImpl: async () => new Response(new ReadableStream({ start(stream) { stream.error(new Error("Connection closed")); } })) }));
  await assert.rejects(failedBody.search(input), e => e instanceof AppleCollectionError && e.code === "network");
});
