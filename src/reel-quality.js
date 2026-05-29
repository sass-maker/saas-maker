const SCORE_DIMENSIONS = [
  'valueClarity',
  'productProofStrength',
  'visualTrust',
  'captionReadability',
  'mobileComposition',
  'cringeRisk',
  'postingReadiness',
];

const PLACEHOLDER_PATTERNS = [/lorem/i, /placeholder/i, /todo/i, /\bxxx\b/i, /rainbow/i];

export function scoreVariant({ brief, variant, proof, render }) {
  const reasons = [];
  const scores = {};

  scores.valueClarity = scoreValueClarity(brief, variant, reasons);
  scores.productProofStrength = scoreProofStrength(proof, brief, reasons);
  scores.visualTrust = scoreVisualTrust(proof, reasons);
  scores.captionReadability = scoreCaptionReadability(brief, variant, reasons);
  scores.mobileComposition = scoreMobileComposition(render, reasons);
  scores.cringeRisk = scoreCringeRisk(brief, variant, reasons);
  scores.postingReadiness = scorePostingReadiness(render, scores, reasons);

  const overall = average(SCORE_DIMENSIONS.map((dimension) => scores[dimension]));
  const gate = decideGate({ scores, overall, render, proof, brief, reasons });

  return {
    scores,
    overall: round(overall),
    reasons,
    status: gate.status,
    gate: gate.summary,
  };
}

export function gateForScore(score) {
  if (!score || !Number.isFinite(score.overall)) return 'video_rejected';
  if (score.overall >= 0.7 && score.scores.productProofStrength >= 0.6) return 'video_ready';
  if (score.overall >= 0.5) return 'needs_review';
  return 'video_rejected';
}

export function describeQuality(score) {
  if (!score) return 'no quality score';
  const lines = [
    `overall ${formatPercent(score.overall)}`,
    ...SCORE_DIMENSIONS.map((dimension) => `${humanize(dimension)}: ${formatPercent(score.scores[dimension])}`),
  ];
  return lines.join('\n');
}

function scoreValueClarity(brief, variant, reasons) {
  const hook = String(variant?.hook ?? brief?.hook ?? '').trim();
  if (!hook) {
    reasons.push('missing hook — value not clear in first 3 seconds');
    return 0.1;
  }
  const words = hook.split(/\s+/).filter(Boolean);
  if (words.length < 3) {
    reasons.push('hook too short to communicate value');
    return 0.4;
  }
  if (words.length > 16) {
    reasons.push('hook too long for first-frame value clarity');
    return 0.5;
  }
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(hook))) {
    reasons.push('hook still has placeholder text');
    return 0.2;
  }
  return 0.85;
}

function scoreProofStrength(proof, brief, reasons) {
  const type = proof?.proofType ?? proof?.type;
  if (!type || type === 'generated_card') {
    reasons.push('no real product proof attached — only generated card');
    return 0.2;
  }
  if (type === 'screenshot' && Array.isArray(proof.paths) && proof.paths.length) {
    return brief.proofUrl || brief.productUrl ? 0.9 : 0.75;
  }
  if (type === 'recording') return 0.95;
  if (type === 'changelog') return 0.7;
  if (type === 'before_after' || type === 'product_artifact') return 0.8;
  return 0.5;
}

function scoreVisualTrust(proof, reasons) {
  const type = proof?.proofType ?? proof?.type;
  if (type === 'generated_card') {
    reasons.push('visuals are abstract cards, not trustworthy product proof');
    return 0.3;
  }
  if (!type) return 0.4;
  if (type === 'repo_screenshot') return 0.6;
  return 0.85;
}

function scoreCaptionReadability(brief, variant, reasons) {
  const hook = String(variant?.hook ?? brief?.hook ?? '');
  const cta = String(variant?.cta ?? brief?.cta ?? '');
  if (!hook || !cta) {
    reasons.push('missing hook or CTA caption');
    return 0.3;
  }
  const longest = Math.max(longestWord(hook), longestWord(cta));
  if (longest > 14) {
    reasons.push('caption has very long words that overflow mobile width');
    return 0.5;
  }
  if (containsEmojiSpam(hook) || containsEmojiSpam(cta)) {
    reasons.push('caption has emoji spam');
    return 0.4;
  }
  return 0.85;
}

function scoreMobileComposition(render, reasons) {
  const aspect = render?.aspect ?? render?.raw?.aspect ?? '9:16';
  if (aspect && aspect !== '9:16') {
    reasons.push(`render aspect ${aspect} is not 9:16`);
    return 0.3;
  }
  const duration = Number(render?.durationSeconds ?? render?.raw?.durationSeconds);
  if (Number.isFinite(duration)) {
    if (duration < 8) {
      reasons.push(`duration ${duration}s under 8s minimum`);
      return 0.5;
    }
    if (duration > 25) {
      reasons.push(`duration ${duration}s over 25s default cap`);
      return 0.55;
    }
  }
  return 0.85;
}

function scoreCringeRisk(brief, variant, reasons) {
  const text = `${variant?.hook ?? ''} ${variant?.cta ?? ''} ${brief?.body ?? ''}`.toLowerCase();
  const cringeMarkers = ['🚀', '🔥', 'game changer', 'crushing it', 'unlock your potential', 'manifest', '10x your', 'mind-blowing'];
  const hits = cringeMarkers.filter((marker) => text.includes(marker.toLowerCase()));
  if (hits.length) {
    reasons.push(`spam/cringe markers present: ${hits.join(', ')}`);
    return Math.max(0.2, 0.7 - hits.length * 0.15);
  }
  return 0.85;
}

function scorePostingReadiness(render, scores, reasons) {
  if (!render || render.status === 'failed') {
    reasons.push('render did not complete');
    return 0.0;
  }
  const url = firstVideoUrl(render);
  if (!url) {
    reasons.push('no asset URL after upload');
    return 0.1;
  }
  if (!/\.(mp4|mov|webm)$/i.test(url)) {
    reasons.push('asset URL is not a video file');
    return 0.4;
  }
  if (scores.productProofStrength < 0.4) return 0.4;
  return 0.85;
}

function decideGate({ scores, overall, reasons }) {
  const fatal = [];
  if (scores.postingReadiness < 0.3) fatal.push('not ready to post');
  if (scores.productProofStrength < 0.3) fatal.push('no real product proof');
  if (scores.captionReadability < 0.4) fatal.push('captions unreadable');

  if (fatal.length) {
    reasons.push(`fatal quality issues: ${fatal.join('; ')}`);
    return { status: 'video_rejected', summary: fatal.join('; ') };
  }

  if (overall >= 0.7 && scores.productProofStrength >= 0.6) {
    return { status: 'video_ready', summary: 'passed quality gate' };
  }
  return { status: 'needs_review', summary: 'manual review required' };
}

function firstVideoUrl(render) {
  if (!render) return null;
  if (typeof render === 'string') return render;
  if (Array.isArray(render.videos)) return render.videos[0] ?? null;
  return render.videoUrl ?? null;
}

function average(values) {
  const list = values.filter((value) => Number.isFinite(value));
  if (!list.length) return 0;
  return list.reduce((total, value) => total + value, 0) / list.length;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function formatPercent(value) {
  return `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`;
}

function humanize(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

function longestWord(text) {
  return String(text)
    .split(/\s+/)
    .reduce((longest, word) => Math.max(longest, word.length), 0);
}

function containsEmojiSpam(text) {
  const emojiCount = (String(text).match(/\p{Extended_Pictographic}/gu) ?? []).length;
  return emojiCount >= 4;
}
