export const LEGACY_DISTRIBUTION_ERROR_CODE = 'legacy_distribution_disabled';

export function legacyDistributionFailure(action = 'distribution') {
  return Object.freeze({
    ok: false,
    code: LEGACY_DISTRIBUTION_ERROR_CODE,
    action,
    message: `${action} is disabled in Reel Pipeline; use the Foundry Postiz adapter`,
  });
}

export function assertLegacyDistributionDisabled(action) {
  const failure = legacyDistributionFailure(action);
  const error = new Error(failure.message);
  error.code = failure.code;
  error.action = failure.action;
  throw error;
}
