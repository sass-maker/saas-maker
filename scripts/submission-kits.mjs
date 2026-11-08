const SITE = 'https://sassmaker.com';
const RECORD_FIELDS = new Set([
  'tagline',
  'shortDescription',
  'longDescription',
  'categoryWords',
  'pricingModel',
  'assets',
  'demoUrl',
  'checkedAt',
]);
const ASSET_FIELDS = new Set([
  'id',
  'kind',
  'label',
  'url',
  'filename',
  'mimeType',
  'width',
  'height',
  'byteSize',
  'sourceUrl',
  'sourceRevision',
  'checkedAt',
  'viewUrl',
  'posterUrl',
]);
const MIME_EXTENSIONS = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'image/svg+xml': ['svg'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
};

function object(value, fields, trail) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${trail}: expected metadata object`);
  for (const key of Object.keys(value))
    if (!fields.has(key)) throw new Error(`${trail}: unsupported field ${key}`);
}
function text(value, trail, max = 5000) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    [...value].some((character) => character.charCodeAt(0) < 32) ||
    /[<>]|(?:bearer\s+[a-z0-9._-]+|(?:api|access|secret)[_-]?key\s*[:=]|(?:token|password|secret|credential)=)|(?:\/Users\/|\/private\/|\/home\/|[a-z]:\\)/i.test(
      value
    )
  )
    throw new Error(`${trail}: invalid public text`);
  return value;
}
export function validatePublicSubmissionUrl(value, trail = 'submission URL') {
  text(value, trail, 2000);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${trail}: expected public HTTPS URL`);
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.port ||
    !host.includes('.') ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === 'localhost' ||
    host.startsWith('[') ||
    /^\d+(?:\.\d+){3}$/.test(host) ||
    /[\\\s]|%(?:00|0a|0d)/i.test(value) ||
    [...url.searchParams.keys()].some((key) =>
      /secret|token|password|credential|signature|api.?key|auth|expires/i.test(key)
    )
  )
    throw new Error(`${trail}: expected public HTTPS URL without credentials`);
  return value;
}
function checkedAt(value, trail) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10)
  )
    throw new Error(`${trail}: invalid checkedAt`);
}
export function validateSubmission(record, productId) {
  if (record === undefined) return undefined;
  const trail = `${productId}.submission`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productId))
    throw new Error(`${trail}: invalid product id`);
  object(record, RECORD_FIELDS, trail);
  for (const key of ['tagline', 'shortDescription', 'longDescription', 'pricingModel'])
    if (record[key] !== undefined) text(record[key], `${trail}.${key}`);
  if (
    record.categoryWords !== undefined &&
    (!Array.isArray(record.categoryWords) || record.categoryWords.length > 30)
  )
    throw new Error(`${trail}: invalid categoryWords`);
  record.categoryWords?.forEach((word) => text(word, `${trail}.categoryWords`, 100));
  if (record.demoUrl !== undefined) validatePublicSubmissionUrl(record.demoUrl, `${trail}.demoUrl`);
  if (record.checkedAt !== undefined) checkedAt(record.checkedAt, trail);
  if (!Array.isArray(record.assets) || record.assets.length > 50)
    throw new Error(`${trail}: assets array required`);
  const ids = new Set();
  for (const asset of record.assets) {
    object(asset, ASSET_FIELDS, `${trail}.assets`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id) || ids.has(asset.id))
      throw new Error(`${trail}: invalid or duplicate asset id`);
    ids.add(asset.id);
    if (!['logo', 'screenshot', 'video'].includes(asset.kind))
      throw new Error(`${trail}: invalid asset kind`);
    text(asset.label, `${trail}.asset.label`, 240);
    if (
      typeof asset.filename !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(asset.filename) ||
      asset.filename.includes('..')
    )
      throw new Error(`${trail}: invalid asset filename`);
    const ext = asset.filename.split('.').at(-1).toLowerCase();
    if (
      !MIME_EXTENSIONS[asset.mimeType]?.includes(ext) ||
      (asset.kind === 'video') !== asset.mimeType.startsWith('video/')
    )
      throw new Error(`${trail}: asset MIME, extension and kind must agree`);
    if (typeof asset.url === 'string' && asset.url.startsWith('/')) {
      if (asset.url !== `/product-assets/${productId}/${asset.filename}`)
        throw new Error(`${trail}: asset must use canonical product asset path`);
    } else {
      validatePublicSubmissionUrl(asset.url, `${trail}.asset.url`);
      const urlFilename = new URL(asset.url).pathname.split('/').at(-1);
      if (
        urlFilename.includes('.') &&
        !MIME_EXTENSIONS[asset.mimeType].includes(urlFilename.split('.').at(-1).toLowerCase())
      )
        throw new Error(`${trail}: asset URL extension must match its MIME`);
    }
    for (const key of ['sourceUrl', 'viewUrl'])
      if (asset[key] !== undefined) validatePublicSubmissionUrl(asset[key], `${trail}.${key}`);
    if (asset.posterUrl !== undefined) {
      if (
        asset.kind !== 'video' ||
        typeof asset.posterUrl !== 'string' ||
        !asset.posterUrl.startsWith(`/product-assets/${productId}/`) ||
        !/^\/[a-zA-Z0-9/._-]+\.(?:png|jpg|jpeg|webp)$/.test(asset.posterUrl) ||
        asset.posterUrl.includes('..')
      )
        throw new Error(`${trail}: invalid video poster URL`);
    }
    for (const key of ['width', 'height', 'byteSize'])
      if (
        asset[key] !== undefined &&
        (!Number.isSafeInteger(asset[key]) ||
          asset[key] < 1 ||
          (key !== 'byteSize' && asset[key] > 32768))
      )
        throw new Error(`${trail}: invalid asset ${key}`);
    if ((asset.width === undefined) !== (asset.height === undefined))
      throw new Error(`${trail}: asset dimensions need width and height`);
    if (asset.sourceRevision !== undefined && !/^[a-f0-9]{7,64}$/.test(asset.sourceRevision))
      throw new Error(`${trail}: invalid sourceRevision`);
    if (asset.checkedAt !== undefined) checkedAt(asset.checkedAt, trail);
  }
  return structuredClone(record);
}
export function submissionEligible(project) {
  return (
    project.roster === 'current' &&
    project.availability === 'public-link' &&
    project.shareable === true
  );
}
export function buildSubmissionKit(project) {
  if (!submissionEligible(project)) return undefined;
  text(project.name, `${project.id}.name`, 240);
  text(project.description, `${project.id}.description`);
  validatePublicSubmissionUrl(project.publicUrl, `${project.id}.publicUrl`);
  const submission = validateSubmission(project.submission, project.id) ?? { assets: [] };
  const assets = submission.assets.map((asset) => ({
    ...asset,
    url: asset.url.startsWith('/') ? `${SITE}${asset.url}` : asset.url,
    ...(asset.posterUrl ? { posterUrl: `${SITE}${asset.posterUrl}` } : {}),
    uploadSuitable: asset.mimeType !== 'image/svg+xml',
    ...(asset.mimeType === 'image/svg+xml'
      ? {
          uploadLimit:
            'SVG is not accepted by many directory image-upload fields; use a raster logo when required.',
        }
      : {}),
  }));
  const missing = ['tagline', 'longDescription', 'pricingModel', 'checkedAt'].filter(
    (key) => !submission[key]
  );
  if (!submission.categoryWords?.length) missing.push('categoryWords');
  for (const kind of ['logo', 'screenshot', 'video'])
    if (!assets.some((asset) => asset.kind === kind)) missing.push(kind);
  if (!assets.some((asset) => asset.kind === 'logo' && asset.uploadSuitable))
    missing.push('rasterLogo');
  return {
    $schema: 'fleet.product-submission-kit.v1',
    id: project.id,
    name: project.name,
    url: project.publicUrl,
    profileUrl: `${SITE}/p/${project.id}`,
    kitUrl: `${SITE}/p/${project.id}/submission.json`,
    briefUrl: `${SITE}/p/${project.id}/brief.txt`,
    tagline: submission.tagline ?? null,
    shortDescription: submission.shortDescription ?? project.description,
    shortDescriptionOrigin: submission.shortDescription
      ? 'submission'
      : 'reviewed-directory-description',
    longDescription: submission.longDescription ?? null,
    categoryWords: submission.categoryWords ?? [],
    pricingModel: submission.pricingModel ?? null,
    demoUrl: submission.demoUrl ?? null,
    checkedAt: submission.checkedAt ?? null,
    assets,
    missing,
    permissions: {
      createAccounts: false,
      publishListings: false,
      acceptReciprocalBadges: false,
      spendMoney: false,
    },
  };
}
export function buildSubmissionKits(projects) {
  return projects.flatMap((project) => {
    const kit = buildSubmissionKit(project);
    return kit ? [kit] : [];
  });
}
export function submissionBrief(kit) {
  const byKind = (kind) =>
    kit.assets
      .filter((asset) => asset.kind === kind)
      .map((asset) => asset.url)
      .join(', ');
  return [
    `# Product brief`,
    '',
    '## Identity',
    '',
    `- **Name:** ${kit.name}`,
    `- **URL:** ${kit.url}`,
    `- **Tagline (≤60 chars):** ${kit.tagline ?? ''}`,
    `- **Short description (~120 chars):** ${kit.shortDescription}`,
    `- **Long description (≤500 chars):** ${kit.longDescription ?? ''}`,
    `- **Category words:** ${kit.categoryWords.join(', ')}`,
    `- **Pricing model:** ${kit.pricingModel ?? ''}`,
    '',
    '## Assets (public download URLs)',
    '',
    `- **Logo (square):** ${byKind('logo')}`,
    `- **Screenshots (2–3):** ${byKind('screenshot')}`,
    `- **Demo URL or video:** ${[kit.demoUrl, byKind('video')].filter(Boolean).join(', ')}`,
    '- **Maker profile:**',
    '',
    ...kit.assets.map(
      (asset) =>
        `- ${asset.label}: ${asset.url} (${asset.mimeType}${asset.width ? `, ${asset.width} × ${asset.height}` : ''}${asset.byteSize ? `, ${asset.byteSize} bytes` : ''})${asset.uploadLimit ? ` ${asset.uploadLimit}` : ''}`
    ),
    '',
    '## Approved claims',
    '',
    '- Use the reviewed copy above exactly; do not invent pricing, dates, users, testimonials, or rankings.',
    '',
    '## Agent permissions',
    '',
    '- **May create accounts:** no',
    '- **May publish/submit listings:** no',
    '- **May accept reciprocal-badge requirements:** no',
    '- **May spend money:** no',
    '- **Human-only steps:** logins, CAPTCHAs, ID verification, and payments require the operator.',
    '',
    '## Missing requirements',
    '',
    ...kit.missing.map((field) => `- ${field}`),
    '- Maker identity and destination-specific requirements require operator input.',
    '',
    `Metadata checked: ${kit.checkedAt ?? 'not recorded'}. This is a dated fact sheet, not a live availability check.`,
    `Machine kit: ${kit.kitUrl}`,
    '',
  ].join('\n');
}
