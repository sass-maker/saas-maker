import { FileJobStore } from './job-store.js';

export const LESSON_STATUSES = new Set([
  'draft',
  'script_ready',
  'script_approved',
  'script_rejected',
  'rendering',
  'video_ready',
  'needs_review',
  'video_rejected',
  'ready_to_post',
  'posted',
]);

const ALLOWED_CHANNELS = new Set(['tiktok', 'instagram', 'youtube_shorts']);

export class FileLessonStore extends FileJobStore {
  constructor(options = {}) {
    super({
      dir:
        options.dir ??
        process.env.LESSON_PIPELINE_DIR ??
        '.reel-pipeline/lessons',
    });
  }
}

export function normalizeLessonInput(input, options = {}) {
  if (!input || typeof input !== 'object') throw new Error('lesson input required');

  const topic = requireString(input.topic, 'topic');
  const learningObjective = requireString(
    input.learningObjective ?? input.learning_objective,
    'learningObjective',
  );

  const keyPoints = normalizeKeyPoints(input.keyPoints ?? input.key_points);
  if (!keyPoints.length) throw new Error('keyPoints must have at least one entry');

  const channel = optionalString(input.channel) ?? 'tiktok';
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`unsupported channel: ${channel}`);
  }

  const durationSeconds = clampDuration(input.durationSeconds ?? input.duration_seconds);
  const variantCount = Math.max(1, Math.min(4, Number(input.variantCount ?? input.variant_count ?? 1)));

  const cta = optionalString(input.cta) ?? 'follow for daily lessons.';
  const audience = optionalString(input.audience) ?? null;
  const example = normalizeExample(input.example);
  const recap = optionalString(input.recap) ?? null;
  const hookStyle = optionalString(input.hookStyle ?? input.hook_style) ?? null;

  const voicePreference = normalizeVoicePreference(input.voicePreference ?? input.voice);

  const id = optionalString(input.id) ?? makeLessonId(options.now?.() ?? new Date());
  const status = optionalString(input.status) ?? 'draft';
  if (!LESSON_STATUSES.has(status)) throw new Error(`unsupported lesson status: ${status}`);

  return {
    id,
    status,
    topic,
    learningObjective,
    audience,
    keyPoints,
    example,
    recap,
    cta,
    hookStyle,
    channel,
    durationSeconds,
    variantCount,
    voicePreference,
    source: optionalString(input.source) ?? 'api',
    scripts: [],
    variants: [],
    decisions: { script: null, video: null },
    renderJob: null,
  };
}

export async function createLessonDraft(input, options = {}) {
  const store = requiredStore(options.lessonStore);
  const record = normalizeLessonInput(input, options);
  return store.save(record);
}

export async function listLessons(filters = {}, options = {}) {
  const store = requiredStore(options.lessonStore);
  const records = await store.list();
  return records.filter((record) => {
    if (filters.status && record.status !== filters.status) return false;
    if (filters.channel && record.channel !== filters.channel) return false;
    return true;
  });
}

export async function getLesson(id, options = {}) {
  const store = requiredStore(options.lessonStore);
  return store.get(id);
}

export async function attachLessonScripts(id, scripts, options = {}) {
  const store = requiredStore(options.lessonStore);
  const record = await store.get(id);
  if (!record) return null;
  if (!Array.isArray(scripts) || !scripts.length) {
    throw new Error('attachLessonScripts requires at least one script');
  }
  return store.save({
    ...record,
    scripts,
    status: 'script_ready',
    scriptsGeneratedAt: new Date().toISOString(),
  });
}

export async function decideLessonScript(id, decision, options = {}) {
  const store = requiredStore(options.lessonStore);
  const record = await store.get(id);
  if (!record) return null;
  const normalizedDecision = normalizeDecision(decision);
  if (record.status !== 'script_ready' && record.status !== 'script_approved' && record.status !== 'script_rejected') {
    throw new Error('lesson script must be generated before decision');
  }
  return store.save({
    ...record,
    status: normalizedDecision === 'approve' ? 'script_approved' : 'script_rejected',
    decisions: { ...(record.decisions ?? {}), script: normalizedDecision },
    scriptDecidedAt: new Date().toISOString(),
  });
}

export async function attachLessonRender(id, renderResult, options = {}) {
  const store = requiredStore(options.lessonStore);
  const record = await store.get(id);
  if (!record) return null;

  const variants = Array.isArray(renderResult.variants) ? renderResult.variants : [];
  if (!variants.length) {
    return store.save({
      ...record,
      status: renderResult.status === 'video_ready' ? 'video_ready' : 'rendering',
      renderJob: renderResult.job ?? null,
    });
  }

  const anyReady = variants.some(
    (variant) => variant.status === 'video_ready' || variant.status === 'needs_review',
  );
  const nextStatus = anyReady
    ? variants.some((variant) => variant.status === 'video_ready')
      ? 'video_ready'
      : 'needs_review'
    : 'video_rejected';

  return store.save({
    ...record,
    status: nextStatus,
    variants,
    renderJob: renderResult.job ?? record.renderJob ?? null,
    assetUrl: firstVariantAsset(variants),
    renderedAt: anyReady ? new Date().toISOString() : record.renderedAt ?? null,
  });
}

export async function decideLessonVideo(id, decision, options = {}) {
  const store = requiredStore(options.lessonStore);
  const record = await store.get(id);
  if (!record) return null;
  const allowed = ['video_ready', 'needs_review', 'ready_to_post', 'video_rejected'];
  if (!allowed.includes(record.status)) {
    throw new Error('lesson video must be rendered before decision');
  }
  const normalizedDecision = normalizeDecision(decision);
  const variantId = typeof decision === 'object' ? optionalString(decision.variantId) : undefined;

  const variants = Array.isArray(record.variants) ? record.variants.slice() : [];
  if (variantId) {
    const index = variants.findIndex((variant) => variant.variantId === variantId);
    if (index === -1) throw new Error(`variant not found: ${variantId}`);
    variants[index] = {
      ...variants[index],
      status: normalizedDecision === 'approve' ? 'ready_to_post' : 'video_rejected',
      decidedAt: new Date().toISOString(),
    };
  }

  const anyReadyToPost = variants.some((variant) => variant.status === 'ready_to_post');
  const remaining = variants.some(
    (variant) => variant.status === 'video_ready' || variant.status === 'needs_review',
  );

  let nextStatus = record.status;
  let nextAsset = record.assetUrl ?? null;
  if (variantId) {
    if (anyReadyToPost) {
      nextStatus = 'ready_to_post';
      const ready = variants.find((variant) => variant.status === 'ready_to_post');
      nextAsset = ready?.assetUrl ?? nextAsset;
    } else if (remaining) {
      nextStatus = 'video_ready';
    } else {
      nextStatus = 'video_rejected';
    }
  } else {
    nextStatus = normalizedDecision === 'approve' ? 'ready_to_post' : 'video_rejected';
  }

  return store.save({
    ...record,
    status: nextStatus,
    assetUrl: nextAsset,
    variants,
    decisions: { ...(record.decisions ?? {}), video: normalizedDecision },
    videoDecidedAt: new Date().toISOString(),
  });
}

function firstVariantAsset(variants) {
  const ready = variants.find((variant) => variant.assetUrl);
  return ready?.assetUrl ?? null;
}

function normalizeKeyPoints(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    return value
      .split(/\n+|;|•/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  return [];
}

function normalizeExample(value) {
  if (!value) return null;
  if (typeof value === 'string') return { setup: null, problem: value.trim(), solution: null };
  if (typeof value !== 'object') return null;
  return {
    setup: optionalString(value.setup) ?? null,
    problem: optionalString(value.problem) ?? null,
    solution: optionalString(value.solution) ?? null,
  };
}

function normalizeVoicePreference(value) {
  if (!value || typeof value !== 'object') return null;
  const provider = optionalString(value.provider) ?? 'elevenlabs';
  return {
    provider,
    voiceId: optionalString(value.voiceId ?? value.voice_id) ?? null,
    modelId: optionalString(value.modelId ?? value.model_id) ?? null,
    stability: typeof value.stability === 'number' ? value.stability : null,
    similarity: typeof value.similarity === 'number' ? value.similarity : null,
  };
}

function normalizeDecision(value) {
  const decision = typeof value === 'string' ? value : value?.decision;
  if (decision === 'approve' || decision === 'approved') return 'approve';
  if (decision === 'reject' || decision === 'rejected') return 'reject';
  throw new Error('decision must be approve or reject');
}

function clampDuration(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 60;
  return Math.max(20, Math.min(90, Math.round(numeric)));
}

function requireString(value, fieldName) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`${fieldName} is required`);
  return text;
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function makeLessonId(now) {
  return `lesson_${now.toISOString().replace(/[^0-9]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}

function requiredStore(store) {
  if (!store) throw new Error('lessonStore is required');
  return store;
}
