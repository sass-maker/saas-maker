export class CapabilityError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CapabilityError';
    this.code = code;
  }
}

export class MissingScopeError extends CapabilityError {
  readonly required: string;
  constructor(required: string) {
    super('MISSING_SCOPE', `Missing required scope: ${required}`);
    this.required = required;
  }
}

export class UnknownEntityError extends CapabilityError {
  constructor(entityId: string) {
    super('UNKNOWN_ENTITY', `No provider registered for entity: ${entityId}`);
  }
}

export class UnknownSourceError extends CapabilityError {
  constructor(source: string, entityId: string) {
    super('UNKNOWN_SOURCE', `Source "${source}" does not provide entity "${entityId}"`);
  }
}

export class UnknownActionError extends CapabilityError {
  constructor(entityId: string, action: string) {
    super('UNKNOWN_ACTION', `Entity "${entityId}" has no action "${action}"`);
  }
}
