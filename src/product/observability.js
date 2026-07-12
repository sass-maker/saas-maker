const SAFE_FIELDS = new Set([
  'event', 'workspaceId', 'jobId', 'attemptId', 'actorId', 'outputId', 'provider',
  'operation', 'state', 'status', 'errorClass', 'durationMs', 'retryCount', 'occurredAt',
]);

const FORBIDDEN_KEY = /(token|secret|password|credential|biometric|face|voice|liveness|content|script|prompt|url)/i;

export function createProductEvent(input) {
  if (!input?.event || !input.occurredAt || !Number.isFinite(Date.parse(input.occurredAt))) {
    throw new ObservabilityError('event and valid timestamp are required');
  }
  const event = {};
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    if (SAFE_FIELDS.has(key) && scalar(value)) event[key] = value;
  }
  if (!event.event || !event.occurredAt) throw new ObservabilityError('event was removed by redaction policy');
  return Object.freeze(event);
}

export function productErrorEvent({ event, error, ...context }) {
  return createProductEvent({
    ...context, event, errorClass: error?.code ?? error?.name ?? 'unknown_error',
    occurredAt: context.occurredAt ?? new Date().toISOString(),
  });
}

export class ObservabilityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ObservabilityError';
    this.code = 'OBSERVABILITY_POLICY_VIOLATION';
  }
}

function scalar(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null;
}
