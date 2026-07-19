export function buildSrtFromScenes(scenes, sceneDurations) {
  const entries = [];
  let cursor = 0;
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const duration = sceneDurations[index];
    const lines = splitNarrationLines(scene.narration);
    if (!lines.length) {
      cursor += duration;
      continue;
    }
    const perLine = duration / lines.length;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const startSeconds = cursor + lineIndex * perLine;
      const endSeconds = Math.min(cursor + (lineIndex + 1) * perLine, cursor + duration);
      entries.push({
        index: entries.length + 1,
        startSeconds,
        endSeconds,
        text: lines[lineIndex],
      });
    }
    cursor += duration;
  }
  return entries
    .map((entry) => `${entry.index}\n${toSrtTimestamp(entry.startSeconds)} --> ${toSrtTimestamp(entry.endSeconds)}\n${entry.text}\n`)
    .join('\n');
}

export function splitNarrationLines(narration) {
  if (typeof narration !== 'string') return [];
  const sentences = narration
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (!sentences.length) return [];
  return sentences.flatMap((sentence) => chunkLongSentence(sentence));
}

function chunkLongSentence(sentence, maxCharsPerLine = 38) {
  if (sentence.length <= maxCharsPerLine) return [sentence];
  const words = sentence.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current.length) {
      current = word;
      continue;
    }
    if ((current + ' ' + word).length <= maxCharsPerLine) {
      current = current + ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function toSrtTimestamp(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00,000';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(wholeSeconds, 2)},${pad(ms, 3)}`;
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}
