import { sha256Bytes, sha256Hex } from './crypto';

export function validSubmissionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function feedbackFingerprint(fields: object, screenshot: File | null) {
  const image = screenshot
    ? { type: screenshot.type, sha256: await sha256Bytes(await screenshot.arrayBuffer()) }
    : null;
  return sha256Hex(JSON.stringify({ fields, image }));
}
