interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 2000; // ~500 tokens
const DEFAULT_OVERLAP_CHARS = 200; // ~50 tokens

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  if (trimmed.length <= maxChars) return [trimmed];

  // Split on paragraph boundaries first
  const paragraphs = trimmed.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para;

    if (candidate.length > maxChars && current) {
      chunks.push(current.trim());
      const overlap = current.slice(-overlapChars).trim();
      current = overlap ? overlap + '\n\n' + para : para;
    } else {
      current = candidate;
    }
  }

  // If current chunk is still too long (single huge paragraph), split on sentences
  if (current.length > maxChars) {
    const sentences = current.split(/(?<=[.!?])\s+/);
    let buf = '';
    for (const sentence of sentences) {
      const candidate = buf ? buf + ' ' + sentence : sentence;
      if (candidate.length > maxChars && buf) {
        chunks.push(...hardSplit(buf.trim(), maxChars, overlapChars));
        const overlap = buf.slice(-overlapChars).trim();
        buf = overlap ? overlap + ' ' + sentence : sentence;
      } else if (candidate.length > maxChars && !buf) {
        chunks.push(...hardSplit(sentence.trim(), maxChars, overlapChars));
        buf = '';
      } else {
        buf = candidate;
      }
    }
    if (buf.trim()) {
      if (buf.trim().length > maxChars) {
        chunks.push(...hardSplit(buf.trim(), maxChars, overlapChars));
      } else {
        chunks.push(buf.trim());
      }
    }
  } else if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Hard-split text on word boundaries when no paragraph or sentence
 * boundaries are available.
 */
function hardSplit(
  text: string,
  maxChars: number,
  overlapChars: number
): string[] {
  if (text.length <= maxChars) return [text];

  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let buf = '';

  for (const word of words) {
    const candidate = buf ? buf + ' ' + word : word;
    if (candidate.length > maxChars && buf) {
      chunks.push(buf.trim());
      const overlap = buf.slice(-overlapChars).trim();
      buf = overlap ? overlap + ' ' + word : word;
    } else {
      buf = candidate;
    }
  }

  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}
