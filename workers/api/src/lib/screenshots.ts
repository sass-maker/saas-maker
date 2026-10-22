import { apiError } from './errors';
import type { AppContext } from '../types';

export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_SCREENSHOT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function validateScreenshot(c: AppContext, file: File): Response | null {
  if (!ALLOWED_SCREENSHOT_TYPES.includes(file.type)) {
    return apiError(c, 415, 'invalid_request', 'Invalid file type. Allowed: jpeg, png, gif, webp');
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    return apiError(c, 413, 'invalid_request', 'File too large. Max 5MB');
  }
  return null;
}

export async function storeScreenshot(
  c: AppContext,
  file: File,
  objectId: string = crypto.randomUUID()
): Promise<string | Response> {
  const invalid = validateScreenshot(c, file);
  if (invalid) return invalid;

  const ext = file.type.split('/')[1];
  const key = `feedback/${objectId}.${ext}`;
  await c.env.FEEDBACK_IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  return `https://images.sassmaker.com/${key}`;
}
