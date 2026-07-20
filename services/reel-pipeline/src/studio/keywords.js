const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search';
const QUESTION_PREFIXES = ['how to', 'what is', 'why', 'best', 'vs'];

export async function researchKeywords({ seed, fetchImpl = fetch, logger = console } = {}) {
  if (!seed || !seed.trim()) throw new Error('seed keyword is required');
  const term = seed.trim().toLowerCase();
  try {
    const queries = [term, ...QUESTION_PREFIXES.map((prefix) => `${prefix} ${term}`)];
    const batches = await Promise.all(queries.map((query) => fetchSuggestions(query, fetchImpl)));
    const ranked = rankSuggestions(term, batches.flat());
    if (!ranked.length) throw new Error('no suggestions returned');
    return { source: 'suggest', seed: term, keywords: ranked };
  } catch (error) {
    logger.warn?.(`keyword research fell back to templates: ${error.message}`);
    return { source: 'template', seed: term, keywords: templateKeywords(term) };
  }
}

async function fetchSuggestions(query, fetchImpl) {
  const url = `${SUGGEST_URL}?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`suggest request failed ${res.status}`);
  const payload = await res.json();
  const suggestions = Array.isArray(payload?.[1]) ? payload[1] : [];
  return suggestions.filter((s) => typeof s === 'string');
}

export function rankSuggestions(seed, suggestions) {
  const seen = new Set();
  const scored = [];
  for (const raw of suggestions) {
    const keyword = raw.trim().toLowerCase();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    let score = 0;
    if (keyword.includes(seed)) score += 2;
    if (/^(how|what|why|best)\b/.test(keyword)) score += 2;
    score += Math.min(3, keyword.split(/\s+/).length - 1);
    scored.push({ keyword, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword))
    .map((entry) => entry.keyword)
    .slice(0, 40);
}

function templateKeywords(term) {
  return [
    term,
    `${term} tutorial`,
    `${term} for beginners`,
    `${term} explained`,
    `how to ${term}`,
    `what is ${term}`,
    `why ${term} matters`,
    `best ${term} tools`,
    `${term} tips`,
    `${term} mistakes`,
    `${term} examples`,
    `${term} vs alternatives`,
  ];
}
