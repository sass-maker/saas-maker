const ENCODER = new TextEncoder();
const HEX_TOKEN = /^[a-f0-9]{64}$/;

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function tokenInput(id: string, email: string): Uint8Array<ArrayBuffer> {
  return ENCODER.encode(`capture:v1:${id}:${email}`);
}

export function captureSigningReady(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.length >= 32;
}

export async function signCaptureToken(secret: string, id: string, email: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    tokenInput(id, email)
  );
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyCaptureToken(
  secret: string,
  id: string,
  email: string,
  token: string
): Promise<boolean> {
  if (!HEX_TOKEN.test(token)) return false;
  const signature = Uint8Array.from(token.match(/../g)!, (byte) => Number.parseInt(byte, 16));
  return crypto.subtle.verify('HMAC', await signingKey(secret), signature, tokenInput(id, email));
}
