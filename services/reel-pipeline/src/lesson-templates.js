const TEMPLATES = [
  {
    id: 'concept_breakdown',
    label: 'Concept Breakdown',
    scenes: ['hook', 'concept', 'example', 'recap', 'cta'],
    matches() {
      return true;
    },
  },
  {
    id: 'before_after',
    label: 'Before / After',
    scenes: ['hook', 'before', 'after', 'recap', 'cta'],
    matches(lesson) {
      const text = JSON.stringify(lesson).toLowerCase();
      return text.includes('before') && text.includes('after');
    },
  },
  {
    id: 'three_mistakes',
    label: '3 Mistakes Most People Make',
    scenes: ['hook', 'mistake_1', 'mistake_2', 'mistake_3', 'cta'],
    matches(lesson) {
      return Array.isArray(lesson.keyPoints) && lesson.keyPoints.length >= 3;
    },
  },
  {
    id: 'walkthrough',
    label: 'Step-by-step Walkthrough',
    scenes: ['hook', 'step_1', 'step_2', 'step_3', 'recap', 'cta'],
    matches(lesson) {
      return Boolean(lesson.example);
    },
  },
];

const HOOK_STYLES = [
  { id: 'curiosity_gap', cue: 'Open with a surprising fact or counter-intuitive claim.' },
  { id: 'pattern_interrupt', cue: 'Open by calling out a common belief and contradicting it in one line.' },
  { id: 'pov', cue: 'Open with "POV:" and put the viewer inside the problem.' },
  { id: 'stakes', cue: 'Open by stating the cost of getting this wrong.' },
];

const TEMPLATE_BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

export function listLessonTemplates() {
  return TEMPLATES.map(({ id, label, scenes }) => ({ id, label, scenes }));
}

export function getLessonTemplate(id) {
  return TEMPLATE_BY_ID.get(id) ?? null;
}

export function selectLessonTemplate(lesson) {
  for (const template of TEMPLATES) {
    if (template.id !== 'concept_breakdown' && template.matches(lesson)) {
      return template;
    }
  }
  return TEMPLATE_BY_ID.get('concept_breakdown');
}

export function planVariants(lesson) {
  const variantCount = Math.max(1, Math.min(4, lesson.variantCount ?? 1));
  const primary = selectLessonTemplate(lesson);
  const ordered = [primary];
  for (const template of TEMPLATES) {
    if (template === primary) continue;
    if (template.matches(lesson)) ordered.push(template);
  }
  while (ordered.length < variantCount) {
    for (const template of TEMPLATES) {
      if (ordered.length >= variantCount) break;
      if (!ordered.includes(template)) ordered.push(template);
    }
  }
  return ordered.slice(0, variantCount).map((template, index) => ({
    variantId: `${lesson.id}-v${index + 1}`,
    template: { id: template.id, label: template.label, scenes: template.scenes },
    hookStyle: HOOK_STYLES[index % HOOK_STYLES.length],
  }));
}
