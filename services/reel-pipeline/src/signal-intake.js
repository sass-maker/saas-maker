import projectUrlsConfig from '../config/project-urls.json' with { type: 'json' };
import { normalizeReelDraftInput } from './reel-intake.js';
import { normalizeVideoBrief } from './video-brief.js';

export const SIGNAL_SOURCE_TYPES = {
  HIGH_SIGNAL_REEL_BRIEF: 'high_signal_reel_brief',
  SAAS_MAKER_IMPROVEMENT: 'saas_maker_improvement',
};

const REEL_CHANNELS = new Set(['tiktok', 'instagram_reels', 'youtube_shorts']);
const IMPROVEMENT_TYPES = new Set(['feature', 'fix', 'improvement']);

export function detectSignalSource(input) {
  const explicit = optionalString(input.signalSource ?? input.signal_source ?? input.sourceType ?? input.source_type);
  if (explicit === SIGNAL_SOURCE_TYPES.HIGH_SIGNAL_REEL_BRIEF || explicit === 'high-signal') {
    return SIGNAL_SOURCE_TYPES.HIGH_SIGNAL_REEL_BRIEF;
  }
  if (explicit === SIGNAL_SOURCE_TYPES.SAAS_MAKER_IMPROVEMENT || explicit === 'saas-maker-improvement') {
    return SIGNAL_SOURCE_TYPES.SAAS_MAKER_IMPROVEMENT;
  }
  if (looksLikeHighSignalReelBrief(input)) return SIGNAL_SOURCE_TYPES.HIGH_SIGNAL_REEL_BRIEF;
  if (looksLikeProductImprovement(input)) return SIGNAL_SOURCE_TYPES.SAAS_MAKER_IMPROVEMENT;
  throw new Error('unable to detect signal source; set signalSource to high_signal_reel_brief or saas_maker_improvement');
}

export function briefFromHighSignalReelBrief(signal, options = {}) {
  const projectSlug = optionalString(signal.productSlug ?? signal.product_slug);
  if (!projectSlug) throw new Error('productSlug is required for High Signal reel brief intake');

  const hook = stringOrThrow(signal.hook, 'hook');
  const title = stringOrThrow(signal.title, 'title');
  const body = optionalString(signal.body) ?? buildBodyFromHighSignal(signal);
  const cta = optionalString(signal.cta) ?? 'Try the product';
  const channel = normalizeChannelOption(options.channel ?? signal.channel);
  const evidenceUrls = normalizeEvidenceUrls(signal.evidenceUrls ?? signal.evidence_urls ?? []);
  const productUrl = options.productUrl ?? resolveProductUrl(projectSlug, options.projectUrls);
  const proofUrl = options.proofUrl ?? firstAbsoluteUrl(evidenceUrls);

  return normalizeVideoBrief({
    id: options.id ?? optionalString(signal.id) ?? `brief-hs-${projectSlug}`,
    projectSlug,
    taskId: optionalString(signal.recommendationId ?? signal.recommendation_id ?? signal.auditId ?? signal.audit_id),
    channel,
    title,
    hook,
    body,
    cta,
    audience: optionalString(signal.humanTension ?? signal.human_tension)
      ?? optionalString(signal.buyerMission ?? signal.buyer_mission),
    productUrl,
    proofUrl,
    proofType: proofTypeForHighSignal(signal, productUrl, evidenceUrls),
    template: options.template ?? templateForProject(projectSlug, body),
    brandTone: 'plainspoken',
    renderMode: options.renderMode ?? 'mock',
    durationSeconds: options.durationSeconds ?? 20,
  });
}

export function briefFromProductImprovement(idea, options = {}) {
  const projectSlug = optionalString(idea.project_slug ?? idea.projectSlug);
  if (!projectSlug) throw new Error('project_slug is required for SaaS Maker improvement intake');

  const projectName = optionalString(idea.project_name ?? idea.projectName) ?? projectSlug;
  const plainTitle = String(idea.title ?? '').replace(/^[^:]+:\s*/, '').trim() || String(idea.title ?? '').trim();
  if (!plainTitle) throw new Error('title is required for SaaS Maker improvement intake');

  const hook = optionalString(idea.hook) ?? `POV: you hit the exact problem ${projectName} just fixed.`;
  const cta = optionalString(idea.cta) ?? `Try ${projectName}: ${plainTitle}`;
  const channel = normalizeChannelOption(options.channel ?? idea.channel);
  const body = optionalString(idea.body) ?? buildBodyFromImprovement({ ...idea, projectName, plainTitle, hook, cta });
  const productUrl = options.productUrl ?? resolveProductUrl(projectSlug, options.projectUrls);

  return normalizeVideoBrief({
    id: options.id ?? optionalString(idea.id) ?? `brief-sm-${projectSlug}`,
    projectSlug,
    taskId: optionalString(idea.task_id ?? idea.taskId),
    marketingPostId: optionalString(idea.marketing_post_id ?? idea.marketingPostId),
    channel,
    title: optionalString(idea.title) ?? `${projectName}: ${plainTitle}`,
    hook,
    body,
    cta,
    audience: optionalString(idea.audience),
    productUrl,
    proofType: productUrl ? 'screenshot' : 'changelog',
    template: options.template ?? (productUrl ? 'problem_proof_cta' : 'changelog_proof'),
    changelogEntryId: optionalString(idea.changelog_entry_id ?? idea.changelogEntryId ?? idea.source_id ?? idea.sourceId),
    brandTone: 'plainspoken',
    renderMode: options.renderMode ?? 'mock',
    durationSeconds: options.durationSeconds ?? 20,
  });
}

export function briefFromSignal(input, options = {}) {
  const source = detectSignalSource(input);
  if (source === SIGNAL_SOURCE_TYPES.HIGH_SIGNAL_REEL_BRIEF) {
    return briefFromHighSignalReelBrief(input, options);
  }
  return briefFromProductImprovement(input, options);
}

export function reelDraftInputFromSignal(input, options = {}) {
  const source = detectSignalSource(input);
  const brief = briefFromSignal(input, options);
  const base = {
    id: options.reelId ?? reelIdFromSignal(input, source),
    projectSlug: brief.projectSlug,
    projectId: brief.projectSlug,
    channel: brief.channel,
    title: brief.title,
    hook: brief.hook,
    body: brief.body,
    cta: brief.cta,
    audience: brief.audience,
    productUrl: brief.productUrl,
    proofUrl: brief.proofUrl,
    taskId: brief.taskId,
    marketingPostId: brief.marketingPostId,
    proofType: brief.proofType,
    template: brief.template,
    brandTone: brief.brandTone,
    changelogEntryId: brief.changelogEntryId,
    status: 'generated',
    source: source === SIGNAL_SOURCE_TYPES.HIGH_SIGNAL_REEL_BRIEF ? 'high-signal' : 'saas-maker-improvement',
    realDetails: buildSourceDetails(input, source, brief),
  };
  return base;
}

export function normalizeReelDraftFromSignal(input, options = {}) {
  return normalizeReelDraftInput(reelDraftInputFromSignal(input, options), options);
}

function buildBodyFromHighSignal(signal) {
  const visualBeats = Array.isArray(signal.visualBeats ?? signal.visual_beats) ? (signal.visualBeats ?? signal.visual_beats) : [];
  const proofPoints = Array.isArray(signal.proofPoints ?? signal.proof_points) ? (signal.proofPoints ?? signal.proof_points) : [];
  const scenes = visualBeats.length ? visualBeats : proofPoints;
  const tension = optionalString(signal.humanTension ?? signal.human_tension)
    ?? optionalString(signal.buyerMission ?? signal.buyer_mission)
    ?? '';
  const proof = optionalString(signal.proofBeat ?? signal.proof_beat) ?? proofPoints[0] ?? '';
  const caption = optionalString(signal.caption) ?? optionalString(signal.title) ?? '';
  const cta = optionalString(signal.cta) ?? 'Try the product';
  const hook = optionalString(signal.hook) ?? caption;
  const boundary = optionalString(signal.claimBoundary ?? signal.claim_boundary);

  return [
    `Script: Open with "${hook}".${tension ? ` Establish tension: ${tension}.` : ''} Show proof: ${proof || 'real product evidence'}. Close with "${cta}".`,
    `Shot list: ${scenes.length
      ? scenes.map((scene, index) => `${index + 1}. ${scene}`).join(' ')
      : 'pain opener; product proof screen; outcome contrast; CTA end card'}.`,
    `Captions: "${hook}" / "${compactText(proof, 80)}" / "${cta}".`,
    `Asset prompts: vertical 9:16 product UI or evidence screen; no generic AI stock montage.${boundary ? ` Claim boundary: ${boundary}` : ''}`,
    'Edit notes: fast first cut, evidence-backed claims only, mute-friendly captions.',
  ].join('\n');
}

function buildBodyFromImprovement(idea) {
  const project = optionalString(idea.projectName) ?? optionalString(idea.project_slug) ?? 'product';
  const plainTitle = optionalString(idea.plainTitle) ?? String(idea.title ?? '').replace(/^[^:]+:\s*/, '').trim();
  const content = optionalString(idea.content) ?? optionalString(idea.body) ?? 'Small product improvement shipped.';
  const hook = optionalString(idea.hook) ?? `POV: you hit the exact problem ${project} just fixed.`;
  const cta = optionalString(idea.cta) ?? `Try ${project}: ${plainTitle}`;

  return [
    `Script: "${hook}" Show before-state pain for "${plainTitle}", then product proof, then payoff.`,
    'Shot list: 0-2s before pain; 2-8s product screen doing the job; 8-14s old workflow contrast; 14-20s result; end card.',
    `Captions: "${hook}" / "${plainTitle}" / "${cta}".`,
    `Asset prompts: concrete ${project} product footage or UI mock; no generic AI stock montage. ${content}`,
    `Edit notes: 9:16 vertical, direct voiceover, specific to ${project}.`,
  ].join('\n');
}

function buildSourceDetails(input, source, brief) {
  if (source === SIGNAL_SOURCE_TYPES.HIGH_SIGNAL_REEL_BRIEF) {
    return {
      signalSource: source,
      signalId: input.id ?? null,
      recommendationId: input.recommendationId ?? input.recommendation_id ?? null,
      evidenceUrls: input.evidenceUrls ?? input.evidence_urls ?? [],
      claimBoundary: input.claimBoundary ?? input.claim_boundary ?? null,
      proofBeat: input.proofBeat ?? input.proof_beat ?? null,
      productUrl: brief.productUrl ?? null,
    };
  }
  return {
    signalSource: source,
    improvementType: input.type ?? null,
    changelogEntryId: brief.changelogEntryId ?? null,
    taskId: brief.taskId ?? null,
    content: optionalString(input.content) ?? null,
  };
}

function looksLikeHighSignalReelBrief(input) {
  const projectSlug = optionalString(input.productSlug ?? input.product_slug);
  const hook = optionalString(input.hook);
  if (!projectSlug || !hook) return false;
  return Boolean(
    Array.isArray(input.visualBeats ?? input.visual_beats)
    || optionalString(input.proofBeat ?? input.proof_beat)
    || optionalString(input.humanTension ?? input.human_tension)
    || Array.isArray(input.proofPoints ?? input.proof_points)
    || Array.isArray(input.evidenceUrls ?? input.evidence_urls),
  );
}

function looksLikeProductImprovement(input) {
  const projectSlug = optionalString(input.project_slug ?? input.projectSlug);
  const title = optionalString(input.title);
  if (!projectSlug || !title) return false;
  const type = optionalString(input.type);
  const sourceType = optionalString(input.source_type ?? input.sourceType);
  return Boolean(
    optionalString(input.content ?? input.body)
    || (type && IMPROVEMENT_TYPES.has(type))
    || sourceType === 'changelog'
    || sourceType === 'task',
  );
}

function proofTypeForHighSignal(signal, productUrl, evidenceUrls) {
  if (productUrl) return 'screenshot';
  if (evidenceUrls.some((url) => String(url).includes('/agent-eval'))) return 'cockpit';
  if (optionalString(signal.proofBeat ?? signal.proof_beat)) return 'product_artifact';
  return 'generated_card';
}

function templateForProject(projectSlug, body) {
  const slug = projectSlug.toLowerCase();
  const text = body.toLowerCase();
  if (/audit|teardown|signal|score|review/.test(text) || /signal|vetter|audit/.test(slug)) {
    return 'teardown_audit';
  }
  if (/before|after|used to|now/.test(text)) return 'before_after';
  if (/changelog|shipped|release|fix/.test(text)) return 'changelog_proof';
  return 'problem_proof_cta';
}

function resolveProductUrl(projectSlug, overrides = {}) {
  const override = overrides?.[projectSlug];
  if (override?.productUrl) return override.productUrl;
  if (override?.fallbackUrl) return override.fallbackUrl;
  const entry = projectUrlsConfig[projectSlug];
  if (!entry || typeof entry !== 'object') return undefined;
  return optionalString(entry.productUrl) ?? optionalString(entry.fallbackUrl);
}

function normalizeChannelOption(channel) {
  const value = optionalString(channel) ?? 'tiktok';
  if (!REEL_CHANNELS.has(value)) throw new Error(`signal intake channel must be a reel channel: ${value}`);
  return value;
}

function normalizeEvidenceUrls(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function firstAbsoluteUrl(urls) {
  for (const url of urls) {
    if (/^https?:\/\//i.test(url)) return url;
  }
  return undefined;
}

function reelIdFromSignal(input, source) {
  const raw = optionalString(input.id);
  if (!raw) return undefined;
  if (source === SIGNAL_SOURCE_TYPES.HIGH_SIGNAL_REEL_BRIEF) {
    return raw.replace(/^reel-/, 'hs-');
  }
  return raw.replace(/^changelog-/, 'sm-');
}

function compactText(value, max = 120) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;
}

function stringOrThrow(value, field) {
  const text = optionalString(value);
  if (!text) throw new Error(`${field} is required`);
  return text;
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
