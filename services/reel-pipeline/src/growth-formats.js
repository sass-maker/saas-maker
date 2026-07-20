export const GROWTH_EXPERIMENT = {
  minDailyPosts: 5,
  maxDailyPosts: 7,
  decisionPostCount: 35,
  decisionRule: 'After 35 posts, double down on formats with repeatable views or switch formats.',
};

const GROWTH_FORMATS = [
  {
    id: 'ranking_system',
    label: 'Ranking System',
    postGoal: 'Rank something in the niche so viewers keep swiping to see the top slots.',
    ctaPlacement: 'Place the product around slot #2 or #3, never as the #1 item.',
    storyboardNotes: [
      'Open with a numbered niche ranking.',
      'Make the viewer curious about the top spot.',
      'Put the product in a high-but-not-first slot.',
      'End with the #1 reveal and a soft CTA.',
    ],
    slideCount: { min: 7, max: 10 },
  },
  {
    id: 'sound_sync',
    label: 'Sound Sync',
    postGoal: 'Make text, transitions, and slide reveals hit on a viral sound beat.',
    ctaPlacement: 'Make the product reveal land on a beat instead of reading like an ad.',
    storyboardNotes: [
      'Pick a platform-allowed sound in the editor.',
      'Draft beat markers, not copyrighted lyric text, inside this repo.',
      'Make each slide reveal depend on the next beat.',
      'Tie the final beat to the product payoff.',
    ],
    slideCount: { min: 5, max: 8 },
  },
  {
    id: 'tutorial_value',
    label: 'Tutorial',
    postGoal: 'Teach one real process and make the app the easiest way to finish it.',
    ctaPlacement: 'Show the product as the cherry on top after useful steps.',
    storyboardNotes: [
      'Start with a specific outcome, not a generic tip.',
      'Teach real steps before naming the product.',
      'Show the product completing or improving the workflow.',
      'Close with a narrow next action.',
    ],
    slideCount: { min: 5, max: 9 },
  },
  {
    id: 'trend_copy',
    label: 'Trend Copy',
    postGoal: 'Copy a proven slideshow structure while replacing the subject, images, and context.',
    ctaPlacement: 'Make the product the contextual twist, not the first slide.',
    storyboardNotes: [
      'Reference only the format mechanics, not protected assets or watermarks.',
      'Replace characters, images, and context with product-specific material.',
      'Keep the first slide as a curiosity gap.',
      'Use the app reveal as the transformed version of the trend.',
    ],
    slideCount: { min: 2, max: 6 },
  },
  {
    id: 'before_after',
    label: 'Before & After',
    postGoal: 'Create a result gap so the viewer needs to see the after state.',
    ctaPlacement: 'Show the product as the mechanism behind the after state.',
    storyboardNotes: [
      'Open with the before state and an unresolved result gap.',
      'Reveal the after state quickly.',
      'Add one receipt showing how the product created the change.',
      'Close before the format starts feeling explained to death.',
    ],
    slideCount: { min: 2, max: 4 },
  },
];

const FORMAT_BY_ID = new Map(GROWTH_FORMATS.map((format) => [format.id, format]));

export function listGrowthFormats() {
  return GROWTH_FORMATS.map((format) => ({ ...format, storyboardNotes: [...format.storyboardNotes] }));
}

export function getGrowthFormat(id) {
  const format = FORMAT_BY_ID.get(id);
  return format ? { ...format, storyboardNotes: [...format.storyboardNotes] } : null;
}

export function selectGrowthFormats(options = {}) {
  const requested = Array.isArray(options.formats) ? options.formats : [];
  const selected = [];
  for (const id of requested) {
    const format = getGrowthFormat(id);
    if (format && !selected.some((entry) => entry.id === format.id)) selected.push(format);
  }
  for (const format of listGrowthFormats()) {
    if (!selected.some((entry) => entry.id === format.id)) selected.push(format);
  }
  return selected.slice(0, Math.max(1, Number(options.count ?? selected.length)));
}

export function buildGrowthExperimentPlan(options = {}) {
  const minDailyPosts = clampInteger(options.minDailyPosts, GROWTH_EXPERIMENT.minDailyPosts, 1, 20);
  const maxDailyPosts = clampInteger(options.maxDailyPosts, GROWTH_EXPERIMENT.maxDailyPosts, minDailyPosts, 20);
  const decisionPostCount = clampInteger(options.decisionPostCount, GROWTH_EXPERIMENT.decisionPostCount, 5, 200);
  return {
    minDailyPosts,
    maxDailyPosts,
    decisionPostCount,
    decisionRule: GROWTH_EXPERIMENT.decisionRule,
    formats: listGrowthFormats().map(({ id, label, ctaPlacement }) => ({ id, label, ctaPlacement })),
  };
}

function clampInteger(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}
