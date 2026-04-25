export type ErrorSeverity = 'fatal' | 'error' | 'warn' | 'info';

export interface FoundryErrorOptions {
  severity?: ErrorSeverity;
  context?: Record<string, any>;
  code?: string;
}

export class FoundryError extends Error {
  public severity: ErrorSeverity;
  public context: Record<string, any>;
  public code?: string;
  public timestamp: number;

  constructor(message: string, options: FoundryErrorOptions = {}) {
    super(message);
    this.name = 'FoundryError';
    this.severity = options.severity || 'error';
    this.context = options.context || {};
    this.code = options.code;
    this.timestamp = Date.now();

    // Ensure stack trace is captured (in Node/V8)
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, FoundryError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}
