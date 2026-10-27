function percentage(numerator, denominator) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1_000) / 10;
}

export function summarizeCatalogIntegrity(results, configured) {
  const checked = results.length;
  const valid = results.filter((result) => result.valid).length;
  const unchecked = Math.max(0, configured - checked);
  const invalid = checked - valid;
  const integrityPercent = percentage(valid, configured);
  const checkedIntegrityPercent = percentage(valid, checked);
  const coveragePercent = percentage(checked, configured);
  const failures = results
    .filter((result) => !result.valid)
    .slice(0, 20)
    .map(({ id, reason }) => ({ id, reason }));

  return {
    status: invalid > 0 ? 'fail' : unchecked > 0 ? 'partial' : 'pass',
    detail:
      `${valid}/${checked} checked catalog surfaces valid (${checkedIntegrityPercent}% of checked); ` +
      `${unchecked} not checked`,
    data: {
      valid,
      invalid,
      configured,
      checked,
      unchecked,
      integrityPercent,
      checkedIntegrityPercent,
      coveragePercent,
      failures,
    },
  };
}
