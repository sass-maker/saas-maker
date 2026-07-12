const ROLE_PERMISSIONS = Object.freeze({
  owner: new Set(['workspace:read', 'workspace:write', 'billing:read', 'billing:write', 'render:read', 'render:write']),
  admin: new Set(['workspace:read', 'workspace:write', 'billing:read', 'render:read', 'render:write']),
  editor: new Set(['workspace:read', 'render:read', 'render:write']),
  viewer: new Set(['workspace:read', 'render:read']),
  service: new Set(['workspace:read', 'render:read', 'render:write']),
});

export function authoriseWorkspaceAccess({ identity, workspaceId, permission, memberships }) {
  if (!identity?.subject || !workspaceId || !permission) throw new AccessDeniedError();
  const membership = memberships.find((candidate) =>
    candidate.subject === identity.subject && candidate.workspaceId === workspaceId && candidate.status === 'active');
  if (!membership || !ROLE_PERMISSIONS[membership.role]?.has(permission)) throw new AccessDeniedError();
  return Object.freeze({ ...membership });
}

export function assertWorkspaceOwnership(record, workspaceId) {
  if (!record || record.workspaceId !== workspaceId) throw new AccessDeniedError();
  return record;
}

export class AccessDeniedError extends Error {
  constructor() {
    super('resource not found');
    this.name = 'AccessDeniedError';
    this.code = 'RESOURCE_NOT_FOUND';
    this.status = 404;
  }
}

export { ROLE_PERMISSIONS };
