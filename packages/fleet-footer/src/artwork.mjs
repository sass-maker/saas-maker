/** Public artwork metadata only: no I/O, private catalog access or fallback assets. */
const CALLER_ALIASES = new Map([
  ['memory-map', 'chatgpt-memory-insights'],
  ['high-signal-podcasts', 'on-record'],
  ['portfolio', 'sarthakagrawal-personal'],
  ['aliveville', 'ai-game'],
]);
const FIELDS = new Set(['src', 'width', 'height', 'alt', 'focalX', 'focalY', 'credit', 'sha256']);
const PRIVATE_TEXT =
  /(?:bearer\s+[a-z0-9._-]+|(?:token|password|credential|(?:api|access|secret)[_-]?key)\s*[:=]|-----BEGIN [A-Z ]+PRIVATE KEY-----|(?:https?|file|data|javascript):|\/(?:Users|home|private|tmp)\/|[a-z]:\\)/i;

function plainText(value, field, maxLength) {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > maxLength ||
    /[<>]/.test(value) ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    }) ||
    PRIVATE_TEXT.test(value)
  ) {
    throw new Error(`footerArt: ${field} must be bounded plain public text`);
  }
}

/** Validate a configured record; an omitted record remains omitted. */
export function validateFooterArt(value, canonicalId) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('footerArt: expected an artwork metadata object');
  }
  for (const key of Object.keys(value)) {
    if (!FIELDS.has(key)) throw new Error(`footerArt: unsupported field ${key}`);
  }
  for (const key of FIELDS) {
    if (!Object.hasOwn(value, key)) throw new Error(`footerArt: missing ${key}`);
  }
  const owner = CALLER_ALIASES.get(canonicalId) ?? canonicalId;
  if (typeof owner !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(owner)) {
    throw new Error('footerArt: invalid canonical product identity');
  }
  if (value.src !== `/footer-art/${owner}.webp` && value.src !== `/footer-art/${owner}.png`) {
    throw new Error('footerArt: src must be the canonical relative public asset path');
  }
  for (const field of ['width', 'height']) {
    if (!Number.isInteger(value[field]) || value[field] < 1 || value[field] > 4096) {
      throw new Error(`footerArt: ${field} must be an integer from 1 to 4096`);
    }
  }
  for (const field of ['focalX', 'focalY']) {
    if (!Number.isFinite(value[field]) || value[field] < 0 || value[field] > 100) {
      throw new Error(`footerArt: ${field} must be a number from 0 to 100`);
    }
  }
  plainText(value.alt, 'alt', 320);
  plainText(value.credit, 'credit', 160);
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sha256)) {
    throw new Error('footerArt: sha256 must contain 64 hexadecimal characters');
  }
  return Object.fromEntries([...FIELDS].map((key) => [key, value[key]]));
}

/** Resolve only filtered public records. Invalid/unconfigured artwork is absent. */
export function resolveFooterArt(projection, callerId) {
  const owner = CALLER_ALIASES.get(callerId) ?? callerId;
  const rows = Array.isArray(projection?.directory)
    ? projection.directory
    : Array.isArray(projection?.products)
      ? projection.products
      : [];
  const project = rows.find((entry) => (CALLER_ALIASES.get(entry?.id) ?? entry?.id) === owner);
  if (!project) return undefined;
  try {
    return validateFooterArt(project.footerArt, owner);
  } catch {
    return undefined;
  }
}
