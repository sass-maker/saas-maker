/** Build a script using only cited website evidence; sparse sites get generic, non-factual copy. */
export function buildEvidenceBackedBrief(intake) {
  if (!intake?.brand || !Array.isArray(intake.brand.facts)) throw new TypeError('website intake evidence is required');
  const facts = intake.brand.facts.filter(validEvidence);
  const description = facts.find((fact) => fact.kind === 'description');
  const heading = facts.find((fact) => fact.kind.startsWith('heading_'));
  const title = facts.find((fact) => fact.kind === 'title');
  const claim = description ?? heading ?? title ?? null;
  const name = intake.brand.name;
  const scenes = [
    scene('hook', `Meet ${name}`, `Take a quick look at ${name}.`, [], intake.canonicalUrl),
  ];
  if (claim) {
    scenes.push(scene('evidence', claim.value, claim.value, [claim], claim.sourceUrl));
  } else {
    scenes.push(scene('evidence', 'Explore the website', 'See what the brand has to share.', [], intake.canonicalUrl));
  }
  scenes.push(scene('cta', `Visit ${new URL(intake.canonicalUrl).hostname.replace(/^www\./, '')}`, `Visit the website to learn more.`, [], intake.canonicalUrl));
  return Object.freeze({
    title: `${name} brand reel`,
    sourceUrl: intake.canonicalUrl,
    scenes: Object.freeze(scenes),
    claims: Object.freeze(claim ? [{ text: claim.value, evidence: Object.freeze([claim]) }] : []),
    assets: Object.freeze({ colors: intake.brand.colors, images: intake.brand.images, captures: intake.captures }),
  });
}

export function assertBriefClaimsSupported(brief) {
  for (const claim of brief?.claims ?? []) {
    if (!claim.text || !Array.isArray(claim.evidence) || !claim.evidence.some((item) => validEvidence(item) && item.value === claim.text)) {
      throw new Error('every factual claim must carry matching website evidence');
    }
  }
  return true;
}

function scene(kind, onScreenText, narration, evidence, sourceUrl) {
  return Object.freeze({ kind, onScreenText, narration, evidence: Object.freeze(evidence), sourceUrl });
}

function validEvidence(value) {
  return Boolean(value?.value && value?.evidence && /^https:\/\//.test(value?.sourceUrl));
}
