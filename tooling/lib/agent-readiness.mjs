export function summarizeReadiness(checks, applicable, identityConflict = false) {
  const pass = applicable.filter((key) => checks[key]?.status === 'pass').length;
  const fail = applicable.filter((key) => checks[key]?.status === 'fail').length;
  const partial = applicable.filter((key) => checks[key]?.status === 'partial').length;
  const score = Math.round((pass / applicable.length) * 100);
  const tier = identityConflict
    ? 'C'
    : fail === 0 && partial === 0 && pass === applicable.length
      ? 'S'
      : pass >= 5
        ? 'A'
        : pass >= 3
          ? 'B'
          : 'C';

  return { tier, score, pass, fail, partial };
}
