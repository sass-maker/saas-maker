export type PostizErrorCategory =
  | 'validation'
  | 'authentication'
  | 'throttling'
  | 'provider'
  | 'network'
  | 'unknown';

export class PostizError extends Error {
  readonly category: PostizErrorCategory;
  readonly code: string;
  readonly status: number | null;
  readonly retryable: boolean;
  attempts: number;

  constructor(options: {
    category: PostizErrorCategory;
    code: string;
    message: string;
    status?: number | null;
    retryable?: boolean;
    attempts?: number;
  }) {
    super(redactPostizText(options.message));
    this.name = 'PostizError';
    this.category = options.category;
    this.code = options.code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
    this.attempts = options.attempts ?? 1;
  }
}

export function classifyPostizHttpError(
  status: number,
  responseText: string,
  knownSecrets: string[] = []
): PostizError {
  const safeBody = redactPostizText(responseText, knownSecrets);
  const suffix = safeBody ? `: ${safeBody}` : '';

  if ([400, 404, 413, 422].includes(status)) {
    return new PostizError({
      category: 'validation',
      code: `POSTIZ_HTTP_${status}`,
      message: `Postiz rejected the request${suffix}`,
      status,
    });
  }
  if (status === 401 || status === 403) {
    return new PostizError({
      category: 'authentication',
      code: `POSTIZ_HTTP_${status}`,
      message: `Postiz authentication failed${suffix}`,
      status,
    });
  }
  if (status === 429) {
    return new PostizError({
      category: 'throttling',
      code: 'POSTIZ_HTTP_429',
      message: `Postiz rate limited the request${suffix}`,
      status,
      retryable: true,
    });
  }
  if (status >= 500) {
    return new PostizError({
      category: 'provider',
      code: `POSTIZ_HTTP_${status}`,
      message: `Postiz failed the request${suffix}`,
      status,
      retryable: true,
    });
  }
  return new PostizError({
    category: 'unknown',
    code: `POSTIZ_HTTP_${status}`,
    message: `Unexpected Postiz response${suffix}`,
    status,
  });
}

export function redactPostizText(value: string, knownSecrets: string[] = []): string {
  let redacted = value;
  for (const secret of knownSecrets) {
    if (secret) redacted = redacted.split(secret).join('[REDACTED]');
  }
  redacted = redacted
    .replace(/\bBearer\s+[^\s,;"']+/gi, 'Bearer [REDACTED]')
    .replace(/\bpos_[a-z0-9._-]+\b/gi, '[REDACTED]')
    .replace(
      /((?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|cookie)\s*[=:]\s*)[^\s,;]+/gi,
      '$1[REDACTED]'
    )
    .replace(/([?&](?:key|api_key|token|access_token|secret)=)[^&#\s]+/gi, '$1[REDACTED]');
  return redacted.slice(0, 500);
}

export function redactPostizValue(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactPostizText(value);
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return '[REDACTED_CYCLE]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, seen));

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? '[REDACTED]' : redactValue(entry, seen);
  }
  return output;
}

function isSensitiveKey(key: string): boolean {
  return /(?:authorization|api[_-]?key|token|secret|password|cookie|credential)/i.test(key);
}
