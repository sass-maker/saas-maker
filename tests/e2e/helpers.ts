export const API_BASE = 'https://api.sassmaker.com';
export const CLI_TOKEN = 'sm_your_cli_token';
export const PROJECT_ID = '8ca6d8d2-2b77-45d9-beb0-9c33c531b4d4';
export const API_KEY = 'pk_your_project_key';

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
