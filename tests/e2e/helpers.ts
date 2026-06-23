function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var ${name} for Playwright e2e API tests.`);
  }
  return value;
}

export const API_BASE = process.env.SAASMAKER_E2E_API_BASE?.trim() || 'https://api.sassmaker.com';
export const CLI_TOKEN = requireEnv('SAASMAKER_E2E_CLI_TOKEN');
export const PROJECT_ID = requireEnv('SAASMAKER_E2E_PROJECT_ID');
export const API_KEY = requireEnv('SAASMAKER_E2E_PROJECT_API_KEY');

/** Headers for dashboard routes that require session auth (CLI token). */
export function authHeaders() {
  return {
    Authorization: `Bearer ${CLI_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/** Headers for public routes that require an API key. */
export function apiKeyHeaders() {
  return {
    'X-Project-Key': API_KEY,
    'Content-Type': 'application/json',
  };
}

/** Generate a unique slug to avoid collisions between test runs. */
export function uniqueSlug(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
