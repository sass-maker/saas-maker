import { resolveStudioLlm } from './llm.js';

export async function deriveVoiceProfile({ transcripts, llm } = {}) {
  const samples = (Array.isArray(transcripts) ? transcripts : [transcripts])
    .filter((t) => typeof t === 'string' && t.trim());
  if (!samples.length) throw new Error('at least one sample transcript is required');
  const heuristics = analyzeSamples(samples);
  const client = resolveStudioLlm({ llm });
  return client.generate({
    messages: [
      { role: 'system', content: 'You analyze creator transcripts and describe their voice. Output strict JSON: {"tone": ["..."], "pacing": "...", "vocabulary": ["..."], "catchphrases": ["..."], "styleNotes": "..."}.' },
      { role: 'user', content: `Describe the voice in these transcript samples:\n\n${samples.map((s) => s.slice(0, 3000)).join('\n\n---\n\n')}\n\nMeasured heuristics: ${JSON.stringify(heuristics)}` },
    ],
    normalize: (raw) => ({
      tone: Array.isArray(raw?.tone) ? raw.tone.slice(0, 5) : heuristics.tone,
      pacing: typeof raw?.pacing === 'string' ? raw.pacing : heuristics.pacing,
      vocabulary: Array.isArray(raw?.vocabulary) ? raw.vocabulary.slice(0, 10) : heuristics.vocabulary,
      catchphrases: Array.isArray(raw?.catchphrases) ? raw.catchphrases.slice(0, 5) : heuristics.catchphrases,
      styleNotes: typeof raw?.styleNotes === 'string' ? raw.styleNotes : heuristics.styleNotes,
      heuristics,
    }),
    fallback: () => ({ ...heuristics, heuristics }),
  });
}

export function analyzeSamples(samples) {
  const text = samples.join(' ');
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 1);
  const words = text.split(/\s+/).filter(Boolean);
  const avgSentenceLength = sentences.length ? words.length / sentences.length : words.length;
  const exclamationRate = sentences.length
    ? sentences.filter((s) => s.trim().endsWith('!')).length / sentences.length
    : 0;
  const questionRate = sentences.length
    ? sentences.filter((s) => s.trim().endsWith('?')).length / sentences.length
    : 0;
  const contractionRate = words.length
    ? words.filter((w) => /\w'(s|t|re|ll|ve|d|m)\b/i.test(w)).length / words.length
    : 0;
  const catchphrases = findRepeatedPhrases(sentences);

  const tone = [];
  tone.push(avgSentenceLength < 12 ? 'punchy' : avgSentenceLength < 20 ? 'conversational' : 'explanatory');
  if (exclamationRate > 0.08) tone.push('energetic');
  if (questionRate > 0.12) tone.push('engaging');
  if (contractionRate > 0.02) tone.push('casual');

  return {
    tone,
    pacing: avgSentenceLength < 12 ? 'fast, short sentences' : avgSentenceLength < 20 ? 'moderate, mixed sentence length' : 'measured, longer explanations',
    vocabulary: topWords(words),
    catchphrases,
    styleNotes: `avg sentence ${avgSentenceLength.toFixed(1)} words; ${(exclamationRate * 100).toFixed(0)}% exclamations; ${(questionRate * 100).toFixed(0)}% questions`,
    metrics: {
      avgSentenceLength: Number(avgSentenceLength.toFixed(1)),
      exclamationRate: Number(exclamationRate.toFixed(3)),
      questionRate: Number(questionRate.toFixed(3)),
      contractionRate: Number(contractionRate.toFixed(3)),
    },
  };
}

const STOPWORDS = new Set(['the', 'and', 'that', 'this', 'with', 'for', 'you', 'your', 'have', 'are', 'was', 'but', 'not', 'they', 'from', 'what', 'about', 'just', 'like', 'can', 'get', 'all', 'out', 'one', 'when', 'how', 'its', "it's", 'their', 'there', 'here', 'will', 'going', 'more', 'them', 'into', 'because', 'really']);

function topWords(words) {
  const counts = new Map();
  for (const raw of words) {
    const word = raw.toLowerCase().replace(/[^a-z']/g, '');
    if (word.length < 4 || STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function findRepeatedPhrases(sentences) {
  const counts = new Map();
  for (const sentence of sentences) {
    const words = sentence.toLowerCase().replace(/[^a-z'\s]/g, '').split(/\s+/).filter(Boolean);
    for (let size = 3; size <= 4; size += 1) {
      for (let i = 0; i + size <= words.length; i += 1) {
        const phrase = words.slice(i, i + size).join(' ');
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);
}
