import { planVariants } from '../lesson-templates.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-chat';

export class DeepSeekClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.model = options.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chatJson(messages, { temperature = 0.7, maxTokens = 2048 } = {}) {
    if (!this.apiKey) throw new Error('DEEPSEEK_API_KEY is required');
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      throw new Error(`DeepSeek request failed ${res.status}: ${await res.text()}`);
    }
    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error('DeepSeek response missing content');
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`DeepSeek returned non-JSON content: ${content.slice(0, 200)}`);
    }
  }
}

export async function generateLessonScripts(lesson, options = {}) {
  const client = options.client ?? new DeepSeekClient(options);
  const plan = planVariants(lesson);
  const scripts = [];
  for (const variant of plan) {
    const script = await generateOneScript(lesson, variant, client);
    scripts.push(script);
  }
  return scripts;
}

async function generateOneScript(lesson, variant, client) {
  const messages = buildPrompt(lesson, variant);
  const data = await client.chatJson(messages, { temperature: 0.8 });
  return normalizeScriptResponse(lesson, variant, data);
}

function buildPrompt(lesson, variant) {
  const systemPrompt = [
    'You are a short-form video scriptwriter for a tutoring brand.',
    'Goal: turn one lesson into a 30-90 second vertical (9:16) script that teaches the concept and earns a follow.',
    'Strict rules:',
    '- Never invent facts. Stay inside the supplied learning objective and key points.',
    '- Hook must land in the first 1.5 seconds. No "in this video" intros.',
    '- Each scene narration is 1-2 sentences, conversational, short words.',
    '- Each scene must include a brollQuery suitable for Pexels stock video search (vertical, abstract or topic-relevant).',
    '- Output strict JSON matching the requested schema. No prose outside JSON.',
  ].join('\n');

  const lessonSpec = {
    topic: lesson.topic,
    learningObjective: lesson.learningObjective,
    audience: lesson.audience,
    keyPoints: lesson.keyPoints,
    example: lesson.example,
    recap: lesson.recap,
    cta: lesson.cta,
    channel: lesson.channel,
    durationSeconds: lesson.durationSeconds,
  };

  const userPrompt = [
    `Lesson:\n${JSON.stringify(lessonSpec, null, 2)}`,
    `Template: ${variant.template.id} with scenes ${JSON.stringify(variant.template.scenes)}`,
    `Hook style: ${variant.hookStyle.id} — ${variant.hookStyle.cue}`,
    `Target total duration: ${lesson.durationSeconds} seconds.`,
    'Produce JSON with this exact shape:',
    JSON.stringify(
      {
        hook: 'string — the opening line, no quotes',
        hashtags: ['#example', '#tags', '#here'],
        scenes: [
          {
            label: 'hook',
            narration: 'string — what the voice says, 1-2 sentences',
            brollQuery: 'string — pexels search term',
            onScreenText: 'string or null — short on-screen overlay text',
            durationSeconds: 4,
          },
        ],
      },
      null,
      2,
    ),
    `Use exactly the scene labels from the template scenes list. Total scene durations should sum to ${lesson.durationSeconds} ± 3.`,
    'Hashtags: 5-8 mixed reach/niche tags, lowercase, no spaces, no #-less duplicates.',
  ].join('\n\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

function normalizeScriptResponse(lesson, variant, data) {
  if (!data || typeof data !== 'object') throw new Error('script response not an object');
  const rawScenes = Array.isArray(data.scenes) ? data.scenes : [];
  if (!rawScenes.length) throw new Error('script response has no scenes');

  const scenes = rawScenes.map((scene, index) => ({
    label: stringValue(scene.label, variant.template.scenes[index] ?? `scene_${index + 1}`),
    narration: stringValue(scene.narration, ''),
    brollQuery: stringValue(scene.brollQuery ?? scene.b_roll_query, ''),
    onScreenText: optionalString(scene.onScreenText ?? scene.on_screen_text),
    durationSeconds: clampSceneDuration(scene.durationSeconds ?? scene.duration_seconds),
  }));

  rebalanceDurations(scenes, lesson.durationSeconds);

  const hashtags = Array.isArray(data.hashtags)
    ? data.hashtags.map(normalizeHashtag).filter(Boolean).slice(0, 12)
    : [];

  return {
    variantId: variant.variantId,
    template: variant.template.id,
    hookStyle: variant.hookStyle.id,
    hook: stringValue(data.hook, scenes[0]?.narration ?? lesson.topic),
    scenes,
    hashtags,
    targetDurationSeconds: lesson.durationSeconds,
    createdAt: new Date().toISOString(),
  };
}

function stringValue(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function optionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function clampSceneDuration(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 4;
  return Math.max(2, Math.min(15, Math.round(numeric)));
}

function rebalanceDurations(scenes, target) {
  const total = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (Math.abs(total - target) <= 2) return;
  const factor = target / total;
  let drift = 0;
  for (const scene of scenes) {
    const scaled = scene.durationSeconds * factor;
    const rounded = Math.max(2, Math.round(scaled + drift));
    drift = scaled + drift - rounded;
    scene.durationSeconds = rounded;
  }
}

function normalizeHashtag(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9#]/g, '');
  if (!cleaned) return '';
  return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
}
