import { describe, expect, it } from 'vitest';
import {
  buildSymphonyBatchPrompt,
  buildSymphonyBatchRuns,
  buildSymphonyDoneCommand,
  buildSymphonyPrompt,
  chooseSymphonyAgent,
} from '../apps/cockpit/src/lib/symphony';

const baseTask = {
  owner_id: 'user-1',
  project_slug: 'saas-maker',
  description: 'Ship the feature',
  status: 'todo',
  priority: 'medium',
  task_type: 'feature',
  created_at: '2026-05-08T00:00:00Z',
  updated_at: '2026-05-08T00:00:00Z',
};

describe('cockpit Symphony helpers', () => {
  it('builds batch prompts with one isolated prompt per task', () => {
    const prompt = buildSymphonyBatchPrompt([
      { ...baseTask, id: 'task-code', title: 'Fix checkout bug', priority: 'high', task_type: 'bug' },
      { ...baseTask, id: 'task-docs', title: 'Summarize docs', task_type: 'docs' },
    ], { memory: 'Prefer Gemini for docs.' });

    expect(prompt).toContain('# Symphony batch item 1: task-code');
    expect(prompt).toContain('# Symphony batch item 2: task-docs');
    expect(prompt).toContain('Task ID: task-code');
    expect(prompt).toContain('Task ID: task-docs');
    expect(prompt).toContain('Routed agent: Codex');
    expect(prompt).toContain('Routed agent: Gemini');
    expect(prompt).toContain('pnpm --dir ~/Desktop/fleet/saas-maker symphony done task-code');
    expect(prompt).toContain('pnpm --dir ~/Desktop/fleet/saas-maker symphony done task-docs');
  });

  it('keeps batch routing task-level instead of reusing one agent for all tasks', () => {
    const runs = buildSymphonyBatchRuns([
      { ...baseTask, id: 'task-bug', title: 'Fix bug', priority: 'high', task_type: 'bug' },
      { ...baseTask, id: 'task-cleanup', title: 'Clean up copy', task_type: 'cleanup' },
    ]);

    expect(runs.map(run => run.route.agent)).toEqual(['codex', 'claude']);
    expect(runs[0].command).toContain('.symphony/workspaces/task-bug/prompt.md');
    expect(runs[1].command).toContain('.symphony/workspaces/task-cleanup/prompt.md');
  });

  it('injects task-specific instructions into copied run prompts', () => {
    const prompt = buildSymphonyPrompt(
      { ...baseTask, id: 'task-one', title: 'Run targeted tests' },
      'Use cheap paths first.',
      'Only touch the CLI surface.',
    );

    expect(prompt).toContain('Symphony operating memory:');
    expect(prompt).toContain('Task-specific instructions:');
    expect(prompt).toContain('Only touch the CLI surface.');
    expect(prompt).toContain('After verification, mark the task done with:');
    expect(prompt).toContain('pnpm --dir ~/Desktop/fleet/saas-maker symphony done task-one');
  });

  it('builds a copyable done command for task handoff prompts', () => {
    expect(buildSymphonyDoneCommand({ ...baseTask, id: 'task-finish', title: 'Finish me' }))
      .toBe('pnpm --dir ~/Desktop/fleet/saas-maker symphony done task-finish');
  });

  it('uses a healthy usage snapshot when routing broad review work', () => {
    const route = chooseSymphonyAgent(
      { ...baseTask, id: 'task-audit', title: 'Audit all project docs', task_type: 'research' },
      '',
      '',
      {
        sampled_at: new Date().toISOString(),
        agents: {
          gemini: {
            ok: true,
            available: true,
            sampled_at: new Date().toISOString(),
            stats: { models: { 'gemini-test': { tokens: { total: 10 } } } },
          },
        },
      },
    );

    expect(route.agent).toBe('gemini');
    expect(route.budgetNote).toContain('Fresh Gemini sample');
  });

  it('falls back to Codex when the matched external agent is unhealthy', () => {
    const route = chooseSymphonyAgent(
      { ...baseTask, id: 'task-docs', title: 'Audit all project docs', task_type: 'research' },
      '',
      '',
      {
        sampled_at: new Date().toISOString(),
        agents: {
          gemini: {
            ok: false,
            available: true,
            sampled_at: new Date().toISOString(),
            error: 'rate limited',
          },
        },
      },
    );

    expect(route.agent).toBe('codex');
    expect(route.reason).toContain('Gemini matched');
  });

  it('renders Claude and Gemini commands with structured output for usage capture', () => {
    const claudeRun = buildSymphonyBatchRuns([
      { ...baseTask, id: 'task-clean', title: 'Clean up docs', task_type: 'cleanup' },
    ])[0];
    const geminiRun = buildSymphonyBatchRuns([
      { ...baseTask, id: 'task-audit', title: 'Audit docs', task_type: 'research' },
    ])[0];

    expect(claudeRun.command).toContain('--output-format json');
    expect(claudeRun.command).toContain('--no-session-persistence');
    expect(geminiRun.command).toContain('--output-format json');
    expect(geminiRun.command).toContain('--skip-trust');
  });
});
