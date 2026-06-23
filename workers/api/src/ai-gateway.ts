import type { AIProviderConfig } from '@saas-maker/contracts';

export interface StoredAIConfig {
  ai_base_url: string | null;
  ai_api_key: string | null;
  ai_model: string | null;
}

export function maskProviderKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return '****';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export function toPublicAIConfig(config: StoredAIConfig): AIProviderConfig {
  return {
    ai_base_url: config.ai_base_url,
    ai_model: config.ai_model,
    ai_api_key_configured: Boolean(config.ai_api_key),
    ai_api_key_preview: maskProviderKey(config.ai_api_key),
  };
}

const ENCRYPTED_KEY_PREFIX = 'enc:v1:';

function encodeBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const padded =
    value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveProviderKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function isEncryptedProviderKey(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(ENCRYPTED_KEY_PREFIX));
}

export async function encryptProviderKey(apiKey: string, secret?: string): Promise<string> {
  if (!secret || isEncryptedProviderKey(apiKey)) return apiKey;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveProviderKey(secret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(apiKey)
  );

  return `${ENCRYPTED_KEY_PREFIX}${encodeBase64Url(iv)}:${encodeBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptProviderKey(
  value: string | null,
  secret?: string
): Promise<string | null> {
  if (!value || !isEncryptedProviderKey(value)) return value;
  if (!secret) {
    throw new Error('AI_GATEWAY_KEY_SECRET is required to decrypt provider keys');
  }

  const payload = value.slice(ENCRYPTED_KEY_PREFIX.length);
  const [ivPart, cipherPart] = payload.split(':');
  if (!ivPart || !cipherPart) {
    throw new Error('Stored AI provider key is malformed');
  }

  const key = await deriveProviderKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(decodeBase64Url(ivPart)) },
    key,
    toArrayBuffer(decodeBase64Url(cipherPart))
  );
  return new TextDecoder().decode(plaintext);
}

export function buildProviderEndpoint(
  baseUrl: string,
  endpoint: 'chat/completions' | 'embeddings'
): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base.endsWith(`/${endpoint}`)) return base;
  if (base.endsWith('/v1')) return `${base}/${endpoint}`;
  return `${base}/v1/${endpoint}`;
}

export function truncateProviderError(message: string | null, maxLength = 500): string | null {
  if (!message) return null;
  return message.length > maxLength ? `${message.slice(0, maxLength)}...` : message;
}

export function extractUsageTokens(payload: unknown): {
  inputTokens: number | null;
  outputTokens: number | null;
} {
  if (!payload || typeof payload !== 'object' || !('usage' in payload)) {
    return { inputTokens: null, outputTokens: null };
  }

  const usage = (payload as { usage?: Record<string, unknown> }).usage;
  if (!usage) return { inputTokens: null, outputTokens: null };

  const input =
    typeof usage.input_tokens === 'number'
      ? usage.input_tokens
      : typeof usage.prompt_tokens === 'number'
        ? usage.prompt_tokens
        : null;

  const output =
    typeof usage.output_tokens === 'number'
      ? usage.output_tokens
      : typeof usage.completion_tokens === 'number'
        ? usage.completion_tokens
        : null;

  return { inputTokens: input, outputTokens: output };
}
