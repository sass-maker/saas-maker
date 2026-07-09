export async function fetchTranscript({ url, fetchImpl = fetch } = {}) {
  const videoId = extractVideoId(url);
  if (!videoId) return { available: false, reason: 'could not extract a YouTube video id from the url' };

  let watchHtml;
  try {
    const res = await fetchImpl(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'accept-language': 'en-US,en;q=0.9' },
    });
    if (!res.ok) return { available: false, reason: `watch page request failed ${res.status}` };
    watchHtml = await res.text();
  } catch (error) {
    return { available: false, reason: `watch page fetch failed: ${error.message}` };
  }

  const track = extractCaptionTrack(watchHtml);
  if (!track) return { available: false, reason: 'video has no public caption tracks' };

  let captionBody;
  try {
    const res = await fetchImpl(track);
    if (!res.ok) return { available: false, reason: `caption track request failed ${res.status}` };
    captionBody = await res.text();
  } catch (error) {
    return { available: false, reason: `caption track fetch failed: ${error.message}` };
  }

  const segments = parseTimedText(captionBody);
  if (!segments.length) return { available: false, reason: 'caption track was empty' };

  return {
    available: true,
    videoId,
    transcript: paragraphize(segments),
    segments,
  };
}

export function extractVideoId(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/(?:shorts|embed|live)\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function extractCaptionTrack(watchHtml) {
  const match = watchHtml.match(/"captionTracks":(\[.*?\])/);
  if (!match) return null;
  let tracks;
  try {
    tracks = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!Array.isArray(tracks) || !tracks.length) return null;
  const preferred = tracks.find((t) => t.languageCode?.startsWith('en') && !t.kind)
    ?? tracks.find((t) => t.languageCode?.startsWith('en'))
    ?? tracks[0];
  const baseUrl = preferred?.baseUrl;
  if (typeof baseUrl !== 'string') return null;
  return baseUrl.replace(/\\u0026/g, '&');
}

export function parseTimedText(xml) {
  const segments = [];
  const pattern = /<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    const text = decodeEntities(match[2]).replace(/\s+/g, ' ').trim();
    if (text) segments.push({ start: Number(match[1]), text });
  }
  return segments;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, '');
}

export function paragraphize(segments, sentencesPerParagraph = 4) {
  const text = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) return text;
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    paragraphs.push(sentences.slice(i, i + sentencesPerParagraph).join(' '));
  }
  return paragraphs.join('\n\n');
}
