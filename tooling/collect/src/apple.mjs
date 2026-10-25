export const APPLE_PROVIDER_VERSION = "apple-public-api/v1";
export const APPLE_MAX_RESPONSE_BYTES = 2_000_000;
export const APPLE_TIMEOUT_MS = 10_000;

export class AppleCollectionError extends Error {
  constructor(code, message, { status = 502, retryAfter = null } = {}) {
    super(message);
    this.name = "AppleCollectionError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
const invalid = (message) => { throw new AppleCollectionError("invalid_query", message, { status: 400 }); };
function fields(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("Apple query must be an object");
  if (Object.keys(input).some((key) => !allowed.includes(key))) invalid("Unknown Apple query field");
}
function shortText(value, max) {
  return typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
}
export function parseAppleAppId(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 && value < 1e15 ? String(value) : null;
  if (typeof value !== "string" || value.length > 2000) return null;
  if (/^[1-9]\d{0,14}$/u.test(value.trim())) return value.trim();
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "apps.apple.com" || url.username || url.password || url.port) return null;
    return url.pathname.match(/^\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id([1-9]\d{0,14})\/?$/u)?.[1] ?? null;
  } catch { return null; }
}
export function normalizeAppleQuery(input) {
  fields(input, input?.kind === "search" ? ["kind", "term", "country", "platform", "limit"] : ["kind", "id", "country", "platform"]);
  if (!["search", "lookup"].includes(input.kind)) invalid("Apple query kind must be search or lookup");
  if (typeof input.country !== "string" || !/^[a-z]{2}$/iu.test(input.country)) invalid("Country must be a two-letter storefront code");
  if (!["ios", "mac"].includes(input.platform)) invalid("Platform must be ios or mac");
  const base = { country: input.country.toLowerCase(), platform: input.platform };
  if (input.kind === "lookup") {
    const id = parseAppleAppId(input.id);
    if (!id) invalid("Lookup requires a numeric Apple ID or an HTTPS apps.apple.com app URL");
    return Object.freeze({ kind: "lookup", id, ...base });
  }
  if (!shortText(input.term, 100)) invalid("Search term must contain at most 100 characters");
  const term = input.term.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
  if (!term || term.length > 100) invalid("Enter a search term of 1–100 characters");
  const limit = input.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 20 || limit > 200) invalid("Search limit must be an integer from 20 to 200");
  return Object.freeze({ kind: "search", term, ...base, limit });
}
export function appleSourceUrl(input) {
  const query = normalizeAppleQuery(input);
  const entity = query.platform === "mac" ? "macSoftware" : "software";
  const url = new URL(`https://itunes.apple.com/${query.kind}`);
  url.search = new URLSearchParams(query.kind === "search"
    ? { term: query.term, country: query.country, media: "software", entity, limit: String(query.limit) }
    : { id: query.id, country: query.country, entity }).toString();
  return url.href;
}
function metadataUrl(value, artwork = false) {
  if (typeof value !== "string" || value.length > 4000) return null;
  try {
    const url = new URL(value);
    const allowed = artwork ? /(^|\.)mzstatic\.com$/u.test(url.hostname) : url.hostname === "apps.apple.com";
    return allowed && url.protocol === "https:" && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}
function appMetadata(value) {
  const fail = () => { throw new AppleCollectionError("provider_shape", "Apple returned unsupported app metadata"); };
  if (!value || typeof value !== "object" || Array.isArray(value) || value.wrapperType !== "software") return fail();
  const id = parseAppleAppId(value.trackId);
  const url = metadataUrl(value.trackViewUrl);
  const text = (value, max = 500) => { if (value == null) return ""; if (!shortText(value, max)) return fail(); return value; };
  const name = text(value.trackName);
  if (!id || !url || !name.trim()) return fail();
  const icon = metadataUrl(value.artworkUrl100, true);
  const number = (value, max, integer = false) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max && (!integer || Number.isInteger(value)) ? value : null;
  return Object.freeze({ id, name, developer: text(value.artistName ?? value.sellerName), url,
    ...(icon ? { icon } : {}), description: text(value.description, 15000), genre: text(value.primaryGenreName),
    rating: number(value.averageUserRating, 5), ratings: number(value.userRatingCount, 1e12, true),
    price: text(value.formattedPrice), version: text(value.version, 100) });
}
function aborted(signal, callerSignal) {
  if (!signal.aborted) return null;
  return callerSignal?.aborted
    ? new AppleCollectionError("cancelled", "Apple collection was cancelled", { status: 499 })
    : new AppleCollectionError("timeout", "Apple did not finish within the collection timeout", { status: 504 });
}
async function within(promise, signal, callerSignal) {
  const error = aborted(signal, callerSignal);
  if (error) throw error;
  let rejectAbort;
  const stop = () => rejectAbort(aborted(signal, callerSignal));
  const abort = new Promise((_, reject) => { rejectAbort = reject; signal.addEventListener("abort", stop, { once: true }); });
  try { return await Promise.race([promise, abort]); }
  finally { signal.removeEventListener("abort", stop); }
}
function retryAfter(response, now) {
  const header = response.headers.get("retry-after");
  if (!header || header.length > 100) return null;
  const value = /^\d+$/u.test(header) ? Number(header) : Math.ceil((Date.parse(header) - now) / 1000);
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
async function responseJson(response, signal, callerSignal) {
  const sizeError = () => new AppleCollectionError("response_too_large", "Apple response exceeds the 2 MB body limit");
  if (Number(response.headers.get("content-length")) > APPLE_MAX_RESPONSE_BYTES) {
    void response.body?.cancel().catch(() => {});
    throw sizeError();
  }
  if (!response.body) throw new AppleCollectionError("provider_shape", "Apple returned an empty response");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const item = await within(reader.read(), signal, callerSignal);
      if (item.done) break;
      size += item.value.byteLength;
      if (size > APPLE_MAX_RESPONSE_BYTES) throw sizeError();
      chunks.push(item.value);
    }
  } catch (error) { void reader.cancel().catch(() => {}); throw aborted(signal, callerSignal) ?? (error instanceof AppleCollectionError ? error : new AppleCollectionError("network", "Apple response could not be read", { status: 504 })); }
  finally { try { reader.releaseLock(); } catch {} }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new AppleCollectionError("provider_shape", "Apple returned invalid JSON"); }
}
export function createAppleCollector({ fetchImpl = globalThis.fetch, reserve, now = () => new Date().toISOString(), timeoutMs = APPLE_TIMEOUT_MS } = {}) {
  if (typeof fetchImpl !== "function" || typeof reserve !== "function" || typeof now !== "function") throw new TypeError("Apple collector requires fetchImpl, now and a shared reservation callback");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > APPLE_TIMEOUT_MS) throw new TypeError("Apple timeout must be 1–10,000 milliseconds");
  async function collect(input, { signal: callerSignal } = {}) {
    const query = normalizeAppleQuery(input);
    const sourceUrl = appleSourceUrl(query);
    if (callerSignal?.aborted) throw new AppleCollectionError("cancelled", "Apple collection was cancelled", { status: 499 });
    const reservation = Promise.resolve().then(() => reserve({ query, sourceUrl, signal: callerSignal }));
    if (callerSignal) await within(reservation, callerSignal, callerSignal);
    else await reservation;
    if (callerSignal?.aborted) throw new AppleCollectionError("cancelled", "Apple collection was cancelled", { status: 499 });
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout;
    let response;
    try { response = await within(Promise.resolve().then(() => fetchImpl(sourceUrl, { signal, redirect: "manual", headers: { accept: "application/json" } })), signal, callerSignal); }
    catch (error) { const stop = aborted(signal, callerSignal); if (stop) throw stop; if (error instanceof AppleCollectionError) throw error; throw new AppleCollectionError("network", "Apple could not be reached", { status: 504 }); }
    if (!response.ok) {
      const wait = retryAfter(response, Date.parse(now()));
      void response.body?.cancel().catch(() => {});
      if (response.status >= 300 && response.status < 400) throw new AppleCollectionError("redirect_denied", "Apple redirected the request; no other destination was fetched");
      throw new AppleCollectionError("upstream_http", `Apple returned HTTP ${response.status}`, { status: response.status === 429 ? 429 : 502, retryAfter: wait });
    }
    const payload = await responseJson(response, signal, callerSignal);
    if (!payload || !Array.isArray(payload.results) || !Number.isInteger(payload.resultCount) || payload.resultCount !== payload.results.length || payload.results.length > (query.kind === "search" ? query.limit : 200)) throw new AppleCollectionError("provider_shape", "Unexpected Apple response shape");
    // macSoftware search includes both native Mac and iPad-on-Mac software.
    // Lookup ignores entity, so software kind alone cannot prove Mac availability.
    const candidates = query.kind === "lookup"
      ? payload.results.filter((item) => item?.wrapperType === "software" && parseAppleAppId(item.trackId) === query.id)
      : payload.results;
    if (candidates.some((item) => item?.wrapperType !== "software" || !["software", "mac-software"].includes(item.kind))) throw new AppleCollectionError("provider_shape", "Apple returned unsupported app records");
    const mismatch = query.platform === "ios" && candidates.some((item) => item.kind === "mac-software");
    if (query.kind === "search" && mismatch) throw new AppleCollectionError("platform_mismatch", "Apple returned another platform; this result set cannot establish positions");
    const matches = mismatch ? [] : candidates;
    const apps = Object.freeze(matches.map(appMetadata));
    if (new Set(apps.map((app) => app.id)).size !== apps.length) throw new AppleCollectionError("provider_shape", "Apple returned inconsistent app identities");
    const notice = query.platform === "mac" && matches.some((item) => item.kind === "software")
      ? query.kind === "lookup"
        ? "Apple lookup does not establish Mac compatibility for this software app. Check its availability in Mac search or the App Store."
        : "Apple Mac search includes iPad apps available on Mac as well as native Mac apps; positions preserve the returned API order."
      : mismatch ? "This Apple ID is a native Mac app. Choose Mac." : undefined;
    const fetchedAt = now();
    if (typeof fetchedAt !== "string" || !Number.isFinite(Date.parse(fetchedAt))) throw new TypeError("Apple clock must return an ISO timestamp");
    const { kind, ...key } = query;
    return Object.freeze({ id: crypto.randomUUID(), kind, key: Object.freeze(key), sourceUrl, fetchedAt: new Date(fetchedAt).toISOString(), apps,
      ...(notice ? { notice } : {}),
      ...(kind === "lookup" ? { match: apps.length ? "matched" : mismatch ? "platform-mismatch" : "not-found" } : {}) });
  }
  return Object.freeze({
    async search(input, options) { fields(input, ["term", "country", "platform", "limit"]); return collect({ ...input, kind: "search" }, options); },
    async lookup(input, options) { fields(input, ["id", "country", "platform"]); return collect({ ...input, kind: "lookup" }, options); },
  });
}
