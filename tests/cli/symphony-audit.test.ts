import { describe, expect, it } from 'vitest';
import { buildRunAuditEvent, DISPATCH_AUDIT_ACTION, PICK_AUDIT_ACTION } from '../../scripts/lib/symphony-audit.mjs';

const task = {
  id: 'task-1',
  project_slug: 'saas-maker',
  priority: 'high',
  task_type: 'feature',
};

describe('buildRunAuditEvent', () => {
  it('builds dispatch metadata without embedding the full prompt', () => {
    const event = buildRunAuditEvent({
      task,
      action: DISPATCH_AUDIT_ACTION,
      agent: 'claude',
      agentCommand: 'claude --model opus -p {prompt}',
      note: 'printed command',
    });

    expect(event).toMatchObject({
      task_id: 'task-1',
      action: DISPATCH_AUDIT_ACTION,
      actor_source: 'local-cli',
      agent_profile: 'claude',
      project_slug: 'saas-maker',
    });
    expect(event.metadata).toMatchObject({
      command_template: 'custom',
      agent: 'claude',
      priority: 'high',
      task_type: 'feature',
      cost_note: 'high-cost agent profile detected - confirm task asked for it',
      note: 'printed command',
    });
    expect(JSON.stringify(event.metadata)).not.toContain('{prompt}');
  });

  it('flags high-cost named agent profiles', () => {
    const event = buildRunAuditEvent({
      task,
      action: PICK_AUDIT_ACTION,
      agent: 'claude-opus',
    });

    expect(event.metadata.cost_note).toContain('high-cost');
  });
});
