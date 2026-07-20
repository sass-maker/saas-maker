const TEMPLATES = [
  {
    id: 'problem_proof_cta',
    label: 'Problem → Product Proof → CTA',
    proofType: 'screenshot',
    scenes: [
      { label: 'Pain', source: 'hook', caption: 'hook' },
      { label: 'Proof', source: 'product_visual', caption: 'proof' },
      { label: 'Action', source: 'cta_card', caption: 'cta' },
    ],
    matches(brief) {
      return Boolean(brief.productUrl || brief.proofUrl || brief.targetRoute || (brief.screenshots && brief.screenshots.length));
    },
  },
  {
    id: 'before_after',
    label: 'Before → After',
    proofType: 'before_after',
    scenes: [
      { label: 'Before', source: 'pain_card', caption: 'before' },
      { label: 'After', source: 'product_visual', caption: 'after' },
      { label: 'Action', source: 'cta_card', caption: 'cta' },
    ],
    matches(brief) {
      const body = String(brief.body ?? '').toLowerCase();
      return body.includes('before') && body.includes('after');
    },
  },
  {
    id: 'changelog_proof',
    label: 'Changelog Proof',
    proofType: 'changelog',
    scenes: [
      { label: 'Shipped', source: 'changelog_card', caption: 'changelog' },
      { label: 'Proof', source: 'product_visual', caption: 'proof' },
      { label: 'Action', source: 'cta_card', caption: 'cta' },
    ],
    matches(brief) {
      return Boolean(brief.changelogEntryId);
    },
  },
  {
    id: 'mini_demo',
    label: 'Mini Demo',
    proofType: 'recording',
    scenes: [
      { label: 'Open', source: 'demo_step_1', caption: 'step1' },
      { label: 'Do', source: 'demo_step_2', caption: 'step2' },
      { label: 'See', source: 'demo_step_3', caption: 'step3' },
    ],
    matches(brief) {
      return Array.isArray(brief.demoSteps) && brief.demoSteps.length >= 2;
    },
  },
  {
    id: 'teardown_audit',
    label: 'Teardown / Audit',
    proofType: 'product_artifact',
    scenes: [
      { label: 'Claim', source: 'hook', caption: 'claim' },
      { label: 'Evidence', source: 'product_visual', caption: 'evidence' },
      { label: 'Recommendation', source: 'cta_card', caption: 'cta' },
    ],
    matches(brief) {
      const body = String(brief.body ?? '').toLowerCase();
      const slug = String(brief.projectSlug ?? '').toLowerCase();
      return /audit|teardown|signal|score|review/.test(body) || /signal|vetter|audit/.test(slug);
    },
  },
];

const TEMPLATE_BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

export function listTemplates() {
  return TEMPLATES.map(({ id, label, proofType }) => ({ id, label, proofType }));
}

export function getTemplate(id) {
  return TEMPLATE_BY_ID.get(id) ?? null;
}

export function selectTemplate(brief) {
  if (brief.template) {
    const explicit = TEMPLATE_BY_ID.get(brief.template);
    if (explicit) return explicit;
  }
  for (const template of TEMPLATES) {
    if (template.matches(brief)) return template;
  }
  return TEMPLATE_BY_ID.get('problem_proof_cta');
}

export function templatesForVariants(brief, variantCount) {
  const primary = selectTemplate(brief);
  const ordered = [primary];
  for (const template of TEMPLATES) {
    if (template === primary) continue;
    if (template.matches(brief)) ordered.push(template);
  }
  if (ordered.length < variantCount) {
    for (const template of TEMPLATES) {
      if (!ordered.includes(template)) ordered.push(template);
      if (ordered.length >= variantCount) break;
    }
  }
  return ordered.slice(0, Math.max(1, variantCount));
}

export function hookVariantsForBrief(brief, count) {
  const base = String(brief.hook ?? brief.title ?? '').trim();
  const project = brief.projectSlug ?? 'this product';
  const cta = brief.cta ?? 'try it once.';
  const pool = [
    base,
    `POV: ${base}`,
    `Stop doing this — ${base}`,
    `${base} (real ${project} output, no slides)`,
    `Three seconds, then you decide: ${base}`,
    `Watch ${project} answer this without you.`,
    `Before you scroll — ${base}`,
  ];
  const unique = [];
  for (const entry of pool) {
    if (typeof entry === 'string' && entry.trim() && !unique.includes(entry.trim())) {
      unique.push(entry.trim());
    }
    if (unique.length >= count) break;
  }
  while (unique.length < count) {
    unique.push(`${base} · v${unique.length + 1}`);
  }
  return unique.slice(0, count).map((hook) => ({ hook, cta }));
}

export function buildVariantPlan(brief, options = {}) {
  const variantCount = Math.max(1, Math.min(6, Number(options.variantCount ?? 1)));
  const templates = templatesForVariants(brief, variantCount);
  const hooks = hookVariantsForBrief(brief, variantCount);
  return templates.map((template, index) => ({
    variantId: `${brief.id}-v${index + 1}`,
    template,
    hook: hooks[index]?.hook ?? brief.hook,
    cta: hooks[index]?.cta ?? brief.cta,
  }));
}
