import { describe, expect, it } from 'vitest';
import {
  buildRunAuditEvent,
  buildRunLedgerRecord,
  DISPATCH_AUDIT_ACTION,
  PICK_AUDIT_ACTION,
} from '../../scripts/lib/symphony-audit.mjs';

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
      note: 'printed command',
    });
    expect(event.metadata.cost_note).toContain('high-cost');
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

  it('builds run ledger metadata for durable start records', () => {
    const record = buildRunLedgerRecord({
      task,
      agent: 'codex',
      pid: 1234,
      terminalHint: 'printed command',
    });

    expect(record).toMatchObject({
      task_id: 'task-1',
      project_slug: 'saas-maker',
      agent_profile: 'codex',
      model_profile: 'codex',
      command_template: 'codex',
      pid: 1234,
      status: 'started',
      workspace_path: '.symphony/workspaces/task-1',
      prompt_path: '.symphony/workspaces/task-1/prompt.md',
      terminal_hint: 'printed command',
      cost_note: 'cheap-default route',
    });
    expect(record.metadata).toMatchObject({
      priority: 'high',
      task_type: 'feature',
    });
  });
});
