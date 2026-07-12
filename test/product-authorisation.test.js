import assert from 'node:assert/strict';
import test from 'node:test';

import { AccessDeniedError, assertWorkspaceOwnership, authoriseWorkspaceAccess } from '../src/product/authorisation.js';

const memberships = [
  { subject: 'user-a', workspaceId: 'workspace-a', role: 'owner', status: 'active' },
  { subject: 'user-b', workspaceId: 'workspace-b', role: 'viewer', status: 'active' },
];

test('workspace access requires an active membership with permission', () => {
  assert.equal(authoriseWorkspaceAccess({
    identity: { subject: 'user-a' }, workspaceId: 'workspace-a', permission: 'billing:write', memberships,
  }).role, 'owner');

  assert.throws(() => authoriseWorkspaceAccess({
    identity: { subject: 'user-b' }, workspaceId: 'workspace-b', permission: 'billing:write', memberships,
  }), AccessDeniedError);
});

test('cross-workspace denials do not disclose whether a record exists', () => {
  assert.throws(() => authoriseWorkspaceAccess({
    identity: { subject: 'user-a' }, workspaceId: 'workspace-b', permission: 'render:read', memberships,
  }), (error) => error.status === 404 && error.message === 'resource not found');
  assert.throws(() => assertWorkspaceOwnership({ id: 'secret', workspaceId: 'workspace-b' }, 'workspace-a'),
    (error) => error.status === 404 && !error.message.includes('workspace-b'));
});

test('internal automation must have an explicit scoped service membership', () => {
  const serviceMemberships = [...memberships, {
    subject: 'service:saas-maker', workspaceId: 'fleet-internal', role: 'service', status: 'active',
  }];
  const membership = authoriseWorkspaceAccess({
    identity: { subject: 'service:saas-maker' }, workspaceId: 'fleet-internal', permission: 'render:write', memberships: serviceMemberships,
  });
  assert.equal(membership.role, 'service');
});
