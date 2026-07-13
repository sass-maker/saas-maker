import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_PRESENTER_MANIFEST = path.join(REPO_ROOT, 'assets', 'presenters', 'manifest.json');
const SHA256 = /^[a-f0-9]{64}$/;
const MEDIA_TYPES = new Set(['image/png', 'image/webp', 'video/mp4', 'video/webm']);

export class PresenterValidationError extends Error {
  constructor(message, code = 'presenter_invalid') {
    super(message);
    this.name = 'PresenterValidationError';
    this.code = code;
  }
}

export async function loadPresenterManifest(manifestPath = DEFAULT_PRESENTER_MANIFEST) {
  let raw;
  try {
    raw = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new PresenterValidationError(`presenter manifest is unavailable: ${error.message}`, 'presenter_manifest_unavailable');
  }
  return validatePresenterManifest(raw, { manifestPath });
}

export function validatePresenterManifest(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PresenterValidationError('presenter manifest must be an object');
  }
  if (input.schema !== 'reel-pipeline.presenter-pack.v1') {
    throw new PresenterValidationError('unsupported presenter manifest schema');
  }
  requiredString(input.packId, 'packId');
  if (!Array.isArray(input.presenters)) throw new PresenterValidationError('presenters must be an array');

  const ids = new Set();
  const presenters = input.presenters.map((entry, index) => {
    const field = `presenters[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new PresenterValidationError(`${field} must be an object`);
    }
    const id = requiredString(entry.id, `${field}.id`);
    if (ids.has(id)) throw new PresenterValidationError(`duplicate presenter id: ${id}`);
    ids.add(id);
    const assetPath = requiredString(entry.assetPath, `${field}.assetPath`);
    if (path.isAbsolute(assetPath) || assetPath.split(/[\\/]/).includes('..')) {
      throw new PresenterValidationError(`${field}.assetPath must stay within the manifest directory`);
    }
    const sha256 = requiredString(entry.sha256, `${field}.sha256`).toLowerCase();
    if (!SHA256.test(sha256)) throw new PresenterValidationError(`${field}.sha256 must be a lowercase SHA-256 digest`);
    const mediaType = requiredString(entry.mediaType, `${field}.mediaType`);
    if (!MEDIA_TYPES.has(mediaType)) throw new PresenterValidationError(`${field}.mediaType is unsupported`);
    const commercialLicenseRef = requiredString(entry.commercialLicenseRef, `${field}.commercialLicenseRef`);
    const likenessType = optionalString(entry.likenessType) ?? 'real-human';
    if (!['real-human', 'synthetic-human'].includes(likenessType)) {
      throw new PresenterValidationError(`${field}.likenessType is unsupported`);
    }
    const modelReleaseRef = likenessType === 'real-human'
      ? requiredString(entry.modelReleaseRef, `${field}.modelReleaseRef`)
      : optionalString(entry.modelReleaseRef);
    let syntheticProvenance = null;
    if (likenessType === 'synthetic-human') {
      if (!entry.syntheticProvenance || typeof entry.syntheticProvenance !== 'object') {
        throw new PresenterValidationError(`${field}.syntheticProvenance is required`);
      }
      if (entry.syntheticProvenance.fictionalIdentity !== true) {
        throw new PresenterValidationError(`${field}.syntheticProvenance.fictionalIdentity must be true`);
      }
      syntheticProvenance = Object.freeze({
        generator: requiredString(entry.syntheticProvenance.generator, `${field}.syntheticProvenance.generator`),
        generationRef: requiredString(entry.syntheticProvenance.generationRef, `${field}.syntheticProvenance.generationRef`),
        createdAt: requiredString(entry.syntheticProvenance.createdAt, `${field}.syntheticProvenance.createdAt`),
        fictionalIdentity: true,
      });
    }
    if (!Array.isArray(entry.allowedTransformations) || entry.allowedTransformations.length === 0) {
      throw new PresenterValidationError(`${field}.allowedTransformations must not be empty`);
    }
    const allowedTransformations = entry.allowedTransformations.map((value, itemIndex) =>
      requiredString(value, `${field}.allowedTransformations[${itemIndex}]`));
    if (!entry.attribution || typeof entry.attribution !== 'object') {
      throw new PresenterValidationError(`${field}.attribution is required`);
    }
    const attributionRequired = entry.attribution.required;
    if (typeof attributionRequired !== 'boolean') {
      throw new PresenterValidationError(`${field}.attribution.required must be boolean`);
    }
    const attributionText = optionalString(entry.attribution.text);
    if (attributionRequired && !attributionText) {
      throw new PresenterValidationError(`${field}.attribution.text is required`);
    }
    if (entry.productionApproved !== true && options.allowTestOnly !== true) {
      throw new PresenterValidationError(`${field} is not approved for production`, 'presenter_not_production_approved');
    }
    return Object.freeze({
      id,
      assetPath,
      sha256,
      mediaType,
      likenessType,
      commercialLicenseRef,
      modelReleaseRef,
      syntheticProvenance,
      allowedTransformations: Object.freeze([...allowedTransformations]),
      attribution: Object.freeze({ required: attributionRequired, text: attributionText ?? null }),
      productionApproved: entry.productionApproved === true,
    });
  });

  return Object.freeze({
    schema: input.schema,
    packId: input.packId,
    manifestPath: path.resolve(options.manifestPath ?? DEFAULT_PRESENTER_MANIFEST),
    productionGate: optionalString(input.productionGate) ?? null,
    presenters: Object.freeze(presenters),
  });
}

export async function resolvePresenter(options = {}) {
  const manifest = options.manifest
    ? validatePresenterManifest(options.manifest, {
      manifestPath: options.manifestPath,
      allowTestOnly: options.allowTestOnly,
    })
    : await loadPresenterManifest(options.manifestPath);
  if (manifest.presenters.length === 0) {
    throw new PresenterValidationError(
      manifest.productionGate ?? 'no approved presenter assets are configured',
      'presenter_pack_empty',
    );
  }
  const presenter = options.presenterId
    ? manifest.presenters.find((entry) => entry.id === options.presenterId)
    : manifest.presenters[0];
  if (!presenter) throw new PresenterValidationError('requested presenter is unavailable', 'presenter_not_found');

  const manifestDir = path.dirname(manifest.manifestPath);
  const assetPath = path.resolve(manifestDir, presenter.assetPath);
  if (assetPath !== manifestDir && !assetPath.startsWith(`${manifestDir}${path.sep}`)) {
    throw new PresenterValidationError('presenter asset escaped the manifest directory');
  }
  let bytes;
  try {
    bytes = await readFile(assetPath);
  } catch (error) {
    throw new PresenterValidationError(`presenter asset is unavailable: ${error.message}`, 'presenter_asset_unavailable');
  }
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== presenter.sha256) {
    throw new PresenterValidationError('presenter asset checksum mismatch', 'presenter_checksum_mismatch');
  }
  return Object.freeze({ ...presenter, assetPath, packId: manifest.packId });
}

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new PresenterValidationError(`${field} is required`);
  return value.trim();
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
