import dns from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';

const DEFAULT_LIMITS = Object.freeze({
  timeoutMs: 10_000,
  maxRedirects: 3,
  maxBytesPerDocument: 1_000_000,
  maxDocuments: 3,
  maxImages: 12,
});

export class WebsiteIntakeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WebsiteIntakeError';
    this.code = code;
  }
}

/** Fetch a small, same-origin set of public HTTPS pages and extract cited brand evidence. */
export async function intakeBrandWebsite(input, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  validateLimits(limits);
  const lookup = options.lookup ?? defaultLookup;
  const request = options.request ?? requestPinnedHttps;
  const capturePage = options.capturePage;
  const startUrl = parsePublicHttpsUrl(input);
  const queued = [startUrl];
  const visited = new Set();
  const documents = [];
  const captures = [];

  while (queued.length && documents.length < limits.maxDocuments) {
    const requestedUrl = queued.shift();
    if (visited.has(requestedUrl.href)) continue;
    visited.add(requestedUrl.href);
    const fetched = await fetchValidatedDocument(requestedUrl, { lookup, request, limits });
    const extracted = extractBrandPage(fetched.body, fetched.url, limits);
    documents.push({
      requestedUrl: requestedUrl.href,
      url: fetched.url.href,
      status: fetched.status,
      bytes: fetched.bytes,
      ...extracted,
    });

    if (capturePage) {
      try {
        // Pass already-fetched markup so capture implementations do not navigate an
        // untrusted URL and independently follow an unvalidated redirect chain.
        const capture = await capturePage({ html: fetched.body, sourceUrl: fetched.url.href, index: documents.length - 1 });
        if (capture) captures.push({ ...capture, sourceUrl: fetched.url.href });
      } catch (error) {
        captures.push({ sourceUrl: fetched.url.href, error: safeError(error) });
      }
    }

    for (const href of extracted.internalLinks) {
      if (queued.length + documents.length >= limits.maxDocuments) break;
      if (!visited.has(href)) queued.push(new URL(href));
    }
  }

  if (!documents.length) throw new WebsiteIntakeError('EXTRACTION_FAILED', 'website produced no readable documents');
  return Object.freeze({
    inputUrl: startUrl.href,
    canonicalUrl: documents[0].canonicalUrl ?? documents[0].url,
    fetchedAt: (options.now ?? (() => new Date()))().toISOString(),
    documents: Object.freeze(documents),
    captures: Object.freeze(captures),
    brand: buildBrandEvidence(documents, limits),
  });
}

export async function fetchValidatedDocument(initialUrl, { lookup = defaultLookup, request = requestPinnedHttps, limits = DEFAULT_LIMITS } = {}) {
  let current = parsePublicHttpsUrl(initialUrl);
  for (let redirects = 0; redirects <= limits.maxRedirects; redirects += 1) {
    const addresses = await resolvePublicAddresses(current.hostname, lookup);
    const response = await request({
      url: current,
      address: addresses[0].address,
      family: addresses[0].family,
      timeoutMs: limits.timeoutMs,
      maxBytes: limits.maxBytesPerDocument,
    });
    const status = Number(response.status ?? response.statusCode);
    const location = header(response.headers, 'location');
    if (status >= 300 && status < 400 && location) {
      if (redirects === limits.maxRedirects) throw new WebsiteIntakeError('TOO_MANY_REDIRECTS', 'website exceeded the redirect limit');
      current = parsePublicHttpsUrl(new URL(location, current));
      continue;
    }
    if (status < 200 || status >= 300) throw new WebsiteIntakeError('BAD_STATUS', `website returned HTTP ${status}`);
    const contentType = header(response.headers, 'content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new WebsiteIntakeError('UNSUPPORTED_CONTENT', 'website response is not HTML');
    }
    const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body ?? '');
    if (body.byteLength > limits.maxBytesPerDocument) throw new WebsiteIntakeError('RESPONSE_TOO_LARGE', 'website response exceeded the byte limit');
    return { url: current, status, body: body.toString('utf8'), bytes: body.byteLength };
  }
  throw new WebsiteIntakeError('TOO_MANY_REDIRECTS', 'website exceeded the redirect limit');
}

export function extractBrandPage(html, source, limits = DEFAULT_LIMITS) {
  if (typeof html !== 'string') throw new WebsiteIntakeError('EXTRACTION_FAILED', 'website document is not text');
  const sourceUrl = parsePublicHttpsUrl(source);
  const title = decodeText(firstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i));
  const description = decodeText(metaContent(html, 'description') ?? metaProperty(html, 'og:description'));
  const siteName = decodeText(metaProperty(html, 'og:site_name'));
  const headings = allMatches(html, /<h[1-2]\b[^>]*>([\s\S]*?)<\/h[1-2]>/gi).map(decodeText).filter(Boolean).slice(0, 8);
  const paragraphs = allMatches(html, /<p\b[^>]*>([\s\S]*?)<\/p>/gi).map(decodeText).filter((text) => text.length >= 20).slice(0, 12);
  const canonicalUrl = safeSameOriginUrl(linkHref(html, 'canonical'), sourceUrl);
  const colors = extractColors(html);
  const images = extractImages(html, sourceUrl, limits.maxImages);
  const internalLinks = extractInternalLinks(html, sourceUrl);
  return {
    canonicalUrl,
    facts: citedValues([
      ['site_name', siteName],
      ['title', title],
      ['description', description],
      ...headings.map((value, index) => [`heading_${index + 1}`, value]),
      ...paragraphs.map((value, index) => [`paragraph_${index + 1}`, value]),
    ], sourceUrl.href),
    colors: colors.map((value) => ({ value, sourceUrl: sourceUrl.href, evidence: value })),
    images,
    internalLinks,
  };
}

export async function resolvePublicAddresses(hostname, lookup = defaultLookup) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    throw new WebsiteIntakeError('PRIVATE_TARGET', 'website host is not public');
  }
  let addresses;
  try {
    addresses = net.isIP(normalized)
      ? [{ address: normalized, family: net.isIP(normalized) }]
      : await lookup(normalized, { all: true, verbatim: true });
  } catch {
    throw new WebsiteIntakeError('DNS_FAILED', 'website host could not be resolved');
  }
  if (!Array.isArray(addresses) || !addresses.length) throw new WebsiteIntakeError('DNS_FAILED', 'website host resolved to no addresses');
  if (addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new WebsiteIntakeError('PRIVATE_TARGET', 'website host resolves to a private or reserved address');
  }
  return addresses;
}

export function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) || a >= 224
    );
  }
  if (family === 6) {
    const value = address.toLowerCase().split('%')[0];
    if (value === '::' || value === '::1') return false;
    if (value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value)) return false;
    if (value.startsWith('ff') || value.startsWith('100:') || value.startsWith('2001:db8:') || value.startsWith('2002:') || value.startsWith('3fff:')) return false;
    if (/^2001:0?[01][0-9a-f]:/.test(value)) return false;
    if (value.startsWith('::ffff:')) return isPublicAddress(value.slice(7));
    return true;
  }
  return false;
}

function buildBrandEvidence(documents, limits) {
  const facts = documents.flatMap((document) => document.facts);
  const colors = uniqueBy(documents.flatMap((document) => document.colors), (item) => item.value).slice(0, 8);
  const images = uniqueBy(documents.flatMap((document) => document.images), (item) => item.url).slice(0, limits.maxImages);
  const named = facts.find((fact) => fact.kind === 'site_name') ?? facts.find((fact) => fact.kind === 'title');
  return Object.freeze({ name: named?.value ?? new URL(documents[0].url).hostname.replace(/^www\./, ''), facts, colors, images });
}

function parsePublicHttpsUrl(value) {
  let url;
  try { url = value instanceof URL ? new URL(value) : new URL(value); } catch {
    throw new WebsiteIntakeError('INVALID_URL', 'a valid HTTPS website URL is required');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443') {
    throw new WebsiteIntakeError('INVALID_URL', 'website URL must use HTTPS without credentials or a custom port');
  }
  url.hash = '';
  return url;
}

function validateLimits(limits) {
  for (const field of ['timeoutMs', 'maxBytesPerDocument', 'maxDocuments', 'maxImages']) {
    if (!Number.isSafeInteger(limits[field]) || limits[field] < 1) throw new TypeError(`${field} must be a positive integer`);
  }
  if (!Number.isSafeInteger(limits.maxRedirects) || limits.maxRedirects < 0) throw new TypeError('maxRedirects must be a non-negative integer');
}

function requestPinnedHttps({ url, address, family, timeoutMs, maxBytes }) {
  return new Promise((resolve, reject) => {
    const tlsHostname = url.hostname.replace(/^\[|\]$/g, '');
    const request = https.request(url, {
      method: 'GET',
      headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'ReelPipelineBrandIntake/1.0' },
      servername: net.isIP(tlsHostname) ? undefined : tlsHostname,
      family,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          request.destroy(new WebsiteIntakeError('RESPONSE_TOO_LARGE', 'website response exceeded the byte limit'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new WebsiteIntakeError('FETCH_TIMEOUT', 'website request timed out')));
    request.on('error', (error) => reject(error instanceof WebsiteIntakeError ? error : new WebsiteIntakeError('FETCH_FAILED', safeError(error))));
    request.end();
  });
}

function extractImages(html, sourceUrl, maxImages) {
  const results = [];
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const raw = attribute(tag, 'src') ?? attribute(tag, 'data-src');
    const url = safeSameOriginUrl(raw, sourceUrl);
    if (!url) continue;
    const alt = decodeText(attribute(tag, 'alt'));
    const role = /logo/i.test(`${raw} ${alt} ${attribute(tag, 'class') ?? ''}`) ? 'logo' : 'product';
    results.push({ url, role, alt, sourceUrl: sourceUrl.href, evidence: tag.slice(0, 500) });
    if (results.length >= maxImages) break;
  }
  const ogImage = safeSameOriginUrl(metaProperty(html, 'og:image'), sourceUrl);
  if (ogImage && results.length < maxImages) results.unshift({ url: ogImage, role: 'social', alt: '', sourceUrl: sourceUrl.href, evidence: 'meta property="og:image"' });
  return uniqueBy(results, (item) => item.url).slice(0, maxImages);
}

function extractInternalLinks(html, sourceUrl) {
  const output = [];
  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = safeSameOriginUrl(attribute(tag, 'href'), sourceUrl);
    if (href && !output.includes(href)) output.push(href);
  }
  return output;
}

function extractColors(html) {
  const values = [metaContent(html, 'theme-color'), ...(html.match(/#[0-9a-f]{3,8}\b/gi) ?? [])].filter(Boolean);
  return [...new Set(values.map((value) => value.toLowerCase()))].slice(0, 8);
}

function safeSameOriginUrl(raw, base) {
  if (!raw) return null;
  try {
    const url = new URL(raw, base);
    url.hash = '';
    return url.protocol === 'https:' && url.origin === base.origin ? url.href : null;
  } catch { return null; }
}

function citedValues(entries, sourceUrl) {
  return entries.filter(([, value]) => value).map(([kind, value]) => ({ kind, value, sourceUrl, evidence: value }));
}

function metaContent(html, name) { return metaValue(html, 'name', name); }
function metaProperty(html, property) { return metaValue(html, 'property', property); }
function metaValue(html, field, value) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attribute(tag, field)?.toLowerCase() === value.toLowerCase()) return attribute(tag, 'content');
  }
  return null;
}
function linkHref(html, rel) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if ((attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes(rel)) return attribute(tag, 'href');
  }
  return null;
}
function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}
function firstMatch(value, pattern) { return value.match(pattern)?.[1] ?? ''; }
function allMatches(value, pattern) { return [...value.matchAll(pattern)].map((match) => match[1]); }
function decodeText(value = '') {
  return String(value ?? '').replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ').trim().slice(0, 2_000);
}
function header(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
function uniqueBy(items, key) { return [...new Map(items.map((item) => [key(item), item])).values()]; }
function safeError(error) { return error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300); }
async function defaultLookup(hostname, options) { return dns.lookup(hostname, options); }

export { DEFAULT_LIMITS };
