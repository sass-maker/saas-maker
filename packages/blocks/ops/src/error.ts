export type FoundryErrorCode =
  | 'RATE_LIMIT'
  | 'DB_ERROR'
  | 'AI_PROVIDER_ERROR'
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export interface FoundryErrorMeta {
  project?: string;
  operation?: string;
  provider?: string;
  [key: string]: unknown;
}

export class FoundryError extends Error {
  readonly code: FoundryErrorCode;
  readonly meta: FoundryErrorMeta;
  readonly originalError?: unknown;

  constructor(
    message: string,
    code: FoundryErrorCode = 'UNKNOWN',
    meta: FoundryErrorMeta = {},
    originalError?: unknown
  ) {
    super(message);
    this.name = 'FoundryError';
    this.code = code;
    this.meta = meta;
    this.originalError = originalError;

    // Preserve original stack if available
    if (originalError instanceof Error && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      meta: this.meta,
    };
  }
}

// Typed error factories
export const FoundryErrors = {
  rateLimit: (msg: string, meta?: FoundryErrorMeta) =>
    new FoundryError(msg, 'RATE_LIMIT', meta),
  db: (msg: string, original?: unknown, meta?: FoundryErrorMeta) =>
    new FoundryError(msg, 'DB_ERROR', meta, original),
  aiProvider: (provider: string, msg: string, original?: unknown) =>
    new FoundryError(msg, 'AI_PROVIDER_ERROR', { provider }, original),
  auth: (msg: string, meta?: FoundryErrorMeta) =>
    new FoundryError(msg, 'AUTH_ERROR', meta),
  notFound: (resource: string, id?: string) =>
    new FoundryError(`${resource} not found${id ? `: ${id}` : ''}`, 'NOT_FOUND', { resource, id }),
  validation: (msg: string, meta?: FoundryErrorMeta) =>
    new FoundryError(msg, 'VALIDATION_ERROR', meta),
};
