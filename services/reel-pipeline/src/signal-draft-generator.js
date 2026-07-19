import { buildVariantPlan } from './reel-templates.js';
import { buildGrowthExperimentPlan, selectGrowthFormats } from './growth-formats.js';
import { briefFromSignal, detectSignalSource } from './signal-intake.js';

const EVIDENCE_REQUIRED_PATTERNS = [
  /\bwill be\b/i,
  /\bfilters?\s+out\b/i,
  /\bfiltered out\b/i,
  /\bagent evaluation\b/i,
  /\bbecoming part of\b/i,
  /\bwithout proof\b/i,
  /\bnot legible\b/i,
];

const HARD_REJECT_PATTERNS = [
  /\bguaranteed\b/i,
  /\b100%\b/i,
  /\b#1\b/i,
  /\bno risk\b/i,
  /\bautonomous(?:ly)?\s+post/i,
  /\bguaranteed ranking/i,
];

const CREATIVE_FRAMING_PATTERNS = [
  /^your reel\b/i,
  /^pov:/i,
  /^stop doing\b/i,
  /^before you scroll\b/i,
];

export function generateSignalReelDraftBundle(signal, options = {}) {
  const source = detectSignalSource(signal);
  const brief = briefFromSignal(signal, options);
  const requestedGrowthFormats = selectGrowthFormats({
    count: options.growthFormatCount ?? options.variantCount ?? 5,
    formats: options.growthFormats,
  });
  const variantCount = Math.max(2, Number(options.variantCount ?? requestedGrowthFormats.length));
  const plan = buildVariantPlan(brief, { variantCount });
  const context = buildSignalContext(signal, brief);
  const claimReview = reviewSignalClaims(signal, context);
  const experimentPlan = buildGrowthExperimentPlan(options.experimentPlan);

  const variants = plan.map((entry, index) => buildVariantBundle({
    entry,
    index,
    brief,
    signal,
    context,
    claimReview,
    growthFormat: requestedGrowthFormats[index % requestedGrowthFormats.length],
  }));

  return {
    prototype: 'signal-to-reel-draft',
    source,
    signalId: optionalString(signal.id) ?? brief.id,
    generatedAt: options.now?.().toISOString?.() ?? new Date().toISOString(),
    targetAudience: context.targetAudience,
    offer: context.offer,
    productConstraints: context.productConstraints,
    evidence: context.evidence,
    claimBoundary: context.claimBoundary,
    experimentPlan,
    claimReview,
    brief,
    variants,
  };
}

function buildSignalContext(signal, brief) {
  const evidenceUrls = normalizeStringList(signal.evidenceUrls ?? signal.evidence_urls);
  const productConstraints = normalizeStringList(
    signal.productConstraints ?? signal.product_constraints ?? signal.constraints,
  );
  return {
    targetAudience: optionalString(signal.targetAudience ?? signal.target_audience)
      ?? optionalString(signal.humanTension ?? signal.human_tension)
      ?? optionalString(signal.buyerMission ?? signal.buyer_mission)
      ?? brief.audience,
    offer: optionalString(signal.offer) ?? optionalString(signal.title),
    productConstraints: productConstraints.length
      ? productConstraints
      : defaultProductConstraints(signal),
    claimBoundary: optionalString(signal.claimBoundary ?? signal.claim_boundary),
    evidence: {
      urls: evidenceUrls,
      proofBeat: optionalString(signal.proofBeat ?? signal.proof_beat),
      productUrl: brief.productUrl ?? null,
      proofUrl: brief.proofUrl ?? null,
    },
  };
}

function defaultProductConstraints(signal) {
  const boundary = optionalString(signal.claimBoundary ?? signal.claim_boundary);
  const constraints = [
    '9:16 vertical draft only; no paid render engines required for prototype output',
    'Evidence-backed claims only; reject unsupported marketing certainty',
  ];
  if (boundary) constraints.push(boundary);
  return constraints;
}

export function reviewSignalClaims(signal, context = buildSignalContext(signal, briefFromSignal(signal))) {
  const rawClaims = extractClaims(signal);
  const forceReject = new Set(
    normalizeStringList(signal.unsupportedClaims ?? signal.unsupported_claims).map((text) => text.toLowerCase()),
  );
  const reviewed = rawClaims.map((claim, index) => {
    const result = reviewClaim(claim, context, index);
    if (forceReject.has(claim.text.toLowerCase())) {
      return {
        ...result,
        rejected: true,
        rejectionReason: result.rejectionReason ?? 'listed as unsupported in signal brief',
        evidenceStatus: 'unsupported',
      };
    }
    return result;
  });
  const approved = reviewed.filter((claim) => !claim.rejected);
  const rejected = reviewed.filter((claim) => claim.rejected);
  const requiresEvidence = reviewed.filter((claim) => claim.requiresEvidence);

  return {
    claims: reviewed,
    approvedClaims: approved,
    rejectedClaims: rejected,
    claimsRequiringEvidence: requiresEvidence,
    summary: {
      total: reviewed.length,
      approved: approved.length,
      rejected: rejected.length,
      requiresEvidence: requiresEvidence.length,
    },
  };
}

function extractClaims(signal) {
  const claims = [];
  const add = (text, source) => {
    const normalized = compactText(text);
    if (!normalized) return;
    claims.push({ text: normalized, source });
  };

  add(signal.hook, 'hook');
  add(signal.title, 'title');
  add(signal.caption, 'caption');
  add(signal.proofBeat ?? signal.proof_beat, 'proofBeat');
  add(signal.humanTension ?? signal.human_tension, 'humanTension');
  add(signal.buyerMission ?? signal.buyer_mission, 'buyerMission');

  for (const beat of normalizeStringList(signal.visualBeats ?? signal.visual_beats)) {
    add(beat, 'visualBeat');
  }
  for (const point of normalizeStringList(signal.proofPoints ?? signal.proof_points)) {
    add(point, 'proofPoint');
  }
  for (const unsupported of normalizeStringList(signal.unsupportedClaims ?? signal.unsupported_claims)) {
    add(unsupported, 'unsupportedClaim');
  }

  const seen = new Set();
  return claims.filter((claim) => {
    const key = claim.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function reviewClaim(claim, context, index) {
  const text = claim.text;
  const requiresEvidence = EVIDENCE_REQUIRED_PATTERNS.some((pattern) => pattern.test(text))
    || claim.source === 'proofBeat'
    || claim.source === 'humanTension';

  let rejected = false;
  let rejectionReason = null;
  let evidenceStatus = 'not_required';
  let evidenceRef = null;

  if (claim.source === 'unsupportedClaim') {
    rejected = true;
    rejectionReason = 'listed as unsupported in signal brief';
    evidenceStatus = 'unsupported';
  } else if (HARD_REJECT_PATTERNS.some((pattern) => pattern.test(text))) {
    rejected = true;
    rejectionReason = 'violates product constraint or uses unsupported certainty language';
    evidenceStatus = 'unsupported';
  } else if (violatesClaimBoundary(text, context.claimBoundary)) {
    rejected = true;
    rejectionReason = 'exceeds claim boundary without linked evidence';
    evidenceStatus = 'unsupported';
  } else if (requiresEvidence) {
    const support = findEvidenceSupport(text, context);
    if (support) {
      evidenceStatus = support.status;
      evidenceRef = support.ref;
    } else if (CREATIVE_FRAMING_PATTERNS.some((pattern) => pattern.test(text))) {
      evidenceStatus = 'creative_framing';
      evidenceRef = 'creative_framing';
    } else {
      rejected = true;
      rejectionReason = 'requires evidence but no linked proof surface substantiates this claim';
      evidenceStatus = 'unsupported';
    }
  }

  return {
    id: `claim-${index + 1}`,
    text,
    source: claim.source,
    requiresEvidence,
    evidenceStatus,
    evidenceRef,
    rejected,
    rejectionReason,
  };
}

function findEvidenceSupport(text, context) {
  const lower = text.toLowerCase();
  const proofBeat = String(context.evidence.proofBeat ?? '').toLowerCase();

  if (proofBeat && overlapScore(lower, proofBeat) >= 0.2) {
    return { status: 'supported', ref: 'proofBeat' };
  }

  for (const url of context.evidence.urls) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('agent-eval') && /audit|readiness|proof|evidence|missing proof/i.test(lower)) {
      return { status: 'supported', ref: url };
    }
    if (urlLower.includes('mckinsey') && /agent|commerce|assistant|merchant|selection/i.test(lower)) {
      return { status: 'supported', ref: url };
    }
  }

  if (context.evidence.productUrl && /high signal|audit screen|proof surface|agent-readiness/i.test(lower)) {
    return { status: 'supported', ref: context.evidence.productUrl };
  }

  if (CREATIVE_FRAMING_PATTERNS.some((pattern) => pattern.test(text))) {
    return { status: 'creative_framing', ref: 'creative_framing' };
  }

  return null;
}

function violatesClaimBoundary(text, boundary) {
  if (!boundary) return false;
  const lower = text.toLowerCase();
  if (/weak signal into certainty|do not turn a weak signal/i.test(boundary)) {
    return /\bdefinitely\b/i.test(lower)
      || /\bproven\b/i.test(lower)
      || /\bguaranteed\b/i.test(lower)
      || /\balways works\b/i.test(lower);
  }
  return false;
}

function buildVariantBundle({ entry, index, brief, signal, context, claimReview, growthFormat }) {
  const hook = sanitizeHookForClaims(entry.hook, claimReview);
  const visualBeats = normalizeStringList(signal.visualBeats ?? signal.visual_beats);
  const storyboard = buildStoryboard(entry, hook, visualBeats, context, index, growthFormat);
  const script = buildScript(entry, hook, context, claimReview, growthFormat);
  const shotList = buildShotList(entry, visualBeats, index, growthFormat, context);
  const captions = buildCaptions(hook, context, claimReview, entry.cta, growthFormat);
  const formatExecution = buildFormatExecution(growthFormat, entry, context);

  return {
    variantId: entry.variantId,
    template: entry.template.id,
    templateLabel: entry.template.label,
    growthFormat: {
      id: growthFormat.id,
      label: growthFormat.label,
      postGoal: growthFormat.postGoal,
      ctaPlacement: growthFormat.ctaPlacement,
    },
    formatExecution,
    hook,
    cta: entry.cta,
    storyboard,
    script,
    shotList,
    captions,
    claims: claimReview.claims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      requiresEvidence: claim.requiresEvidence,
      evidenceStatus: claim.evidenceStatus,
      evidenceRef: claim.evidenceRef,
      rejected: claim.rejected,
      rejectionReason: claim.rejectionReason,
    })),
    rejectedClaims: claimReview.rejectedClaims,
  };
}

function buildStoryboard(entry, hook, visualBeats, context, variantIndex, growthFormat) {
  const scenes = entry.template.scenes ?? [];
  const beats = buildFormatBeats(growthFormat, visualBeats, context, entry);
  const fallbackBeats = [
    'Open on the buyer decision tension',
    'Show assistants filtering products without proof',
    'Cut to on-product audit evidence',
    'Close with the next action',
  ];
  const resolvedBeats = beats.length ? beats : fallbackBeats;
  const offset = variantIndex % Math.max(1, resolvedBeats.length - scenes.length + 1);

  return scenes.map((scene, sceneIndex) => {
    const beat = resolvedBeats[sceneIndex + offset] ?? resolvedBeats[sceneIndex] ?? resolvedBeats[resolvedBeats.length - 1];
    return {
      beat: sceneIndex + 1,
      label: scene.label,
      durationSeconds: sceneIndex === 0 ? 3 : sceneIndex === scenes.length - 1 ? 4 : 5,
      visual: beat,
      voiceover: sceneIndex === 0 ? hook : beat,
      onScreenText: scene.caption === 'hook' ? hook : scene.caption === 'cta' ? entry.cta : compactText(beat, 72),
      evidenceRef: scene.label === 'Evidence' || scene.label === 'Proof'
        ? (context.evidence.proofUrl ?? context.evidence.urls[0] ?? context.evidence.productUrl)
        : null,
      growthFormat: growthFormat.id,
    };
  });
}

function buildScript(entry, hook, context, claimReview, growthFormat) {
  const proofClaim = claimReview.approvedClaims.find((claim) => claim.source === 'proofBeat')
    ?? claimReview.approvedClaims.find((claim) => claim.evidenceStatus === 'supported');
  const proofLine = proofClaim?.text ?? context.evidence.proofBeat ?? 'Show linked product evidence only.';
  return [
    `0-3s HOOK: ${hook}`,
    `3-8s FORMAT: ${growthFormat.label} — ${growthFormat.postGoal}`,
    `8-14s TENSION: ${context.targetAudience ?? 'Target buyer'} — ${context.offer ?? entry.template.label}.`,
    `14-18s PROOF: ${proofLine}`,
    `18-20s CTA: ${entry.cta}`,
    `CTA PLACEMENT: ${growthFormat.ctaPlacement}`,
  ].join('\n');
}

function buildShotList(entry, visualBeats, variantIndex, growthFormat, context) {
  const formatBeats = buildFormatBeats(growthFormat, visualBeats, context, entry);
  if (formatBeats.length) {
    const rotated = [...formatBeats.slice(variantIndex), ...formatBeats.slice(0, variantIndex)];
    return rotated.map((beat, index) => `${index + 1}. ${beat}`);
  }
  return entry.template.scenes.map((scene, index) => `${index + 1}. ${scene.label} — ${scene.source}`);
}

function buildCaptions(hook, context, claimReview, cta, growthFormat) {
  const proofClaim = claimReview.approvedClaims.find((claim) => claim.source === 'proofBeat' && !claim.rejected);
  const proofCaption = proofClaim?.text ?? compactText(context.evidence.proofBeat, 90) ?? 'Evidence on screen';
  return {
    hook,
    proof: proofCaption,
    cta,
    overlayNotes: `Mute-friendly; ${growthFormat.label}; ${growthFormat.ctaPlacement}`,
  };
}

function buildFormatExecution(growthFormat, entry, context) {
  return {
    formatId: growthFormat.id,
    slideTarget: `${growthFormat.slideCount.min}-${growthFormat.slideCount.max} slides`,
    ctaPlacement: growthFormat.ctaPlacement,
    productionNotes: growthFormat.storyboardNotes,
    metricsToWatch: ['views', 'average_watch', 'completion', 'saves', 'shares', 'comments', 'qualified_clicks'],
    productInsertion: context.offer ?? entry.cta ?? 'Use the product as the payoff, not the opening ad.',
  };
}

function buildFormatBeats(growthFormat, visualBeats, context = {}, entry = {}) {
  const product = context.offer ?? entry.cta ?? 'the product';
  const proof = context.evidence?.proofBeat ?? 'visible product proof';
  const beats = {
    ranking_system: [
      `Rank the top niche mistakes or tactics; keep the top slot unresolved.`,
      `Show a mid-list item the audience recognizes from their own workflow.`,
      `Place ${product} around slot #2 or #3 with a concrete proof receipt.`,
      `Reveal the #1 item as a non-product insight so the post does not feel like an ad.`,
    ],
    sound_sync: [
      'Beat 1: opening text lands on the first sound hit.',
      'Beat 2: slide reveal creates the curiosity gap.',
      `Drop: show ${proof}.`,
      `Final beat: ${product} payoff and soft CTA.`,
    ],
    tutorial_value: [
      'Open with the specific outcome the viewer wants.',
      'Teach the manual step before mentioning the product.',
      `Show ${product} completing the hard step faster or cleaner.`,
      'Close with one repeatable action the viewer can try today.',
    ],
    trend_copy: [
      'Use the trend structure as the shell while replacing all assets and context.',
      'Slide 1 sets up the familiar curiosity gap.',
      `Slide 2 transforms the format into ${product}.`,
      'Final slide adds a product-specific receipt and CTA.',
    ],
    before_after: [
      'Slide 1: before state with a clear unresolved result gap.',
      `Slide 2: after state created by ${product}.`,
      `Slide 3: proof receipt — ${proof}.`,
    ],
  };
  return beats[growthFormat.id] ?? visualBeats;
}

function sanitizeHookForClaims(hook, claimReview) {
  const hookText = String(hook ?? '');
  const hookLower = hookText.toLowerCase();
  for (const rejected of claimReview.rejectedClaims) {
    if (hookLower.includes(rejected.text.toLowerCase())) {
      const fallback = claimReview.approvedClaims.find((claim) => claim.source === 'caption' && !claim.rejected)
        ?? claimReview.approvedClaims.find((claim) => claim.source === 'hook' && !claim.rejected);
      return fallback?.text ?? 'Draft hook removed — unsupported claim rejected';
    }
  }
  return hookText;
}

function overlapScore(a, b) {
  const tokensA = new Set(a.split(/\W+/).filter((token) => token.length > 3));
  const tokensB = b.split(/\W+/).filter((token) => token.length > 3);
  if (!tokensA.size || !tokensB.length) return 0;
  let overlap = 0;
  for (const token of tokensB) {
    if (tokensA.has(token)) overlap += 1;
  }
  return overlap / tokensB.length;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function compactText(value, max = 200) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
