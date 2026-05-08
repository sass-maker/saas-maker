import { describe, expect, it } from 'vitest';
import {
  findNextTask,
  isTaskBlocked,
  sortTasksRunnableFirst,
} from '../../scripts/symphony-tasks.mjs';

interface TaskFixture {
  id: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  project_slug?: string | null;
  dependencies?: string[];
  created_at?: string;
}

const baseTask = (overrides: Partial<TaskFixture>): TaskFixture => ({
  id: overrides.id ?? 't',
  status: overrides.status ?? 'todo',
  priority: overrides.priority ?? 'medium',
  project_slug: overrides.project_slug ?? null,
  dependencies: overrides.dependencies ?? [],
  created_at: overrides.created_at ?? '2026-05-01T00:00:00Z',
});

describe('isTaskBlocked', () => {
  it('returns false when there are no dependencies', () => {
    const task = baseTask({ id: 'a' });
    expect(isTaskBlocked(task, [task])).toBe(false);
  });

  it('returns true when any prerequisite is not done', () => {
    const a = baseTask({ id: 'a', status: 'todo' });
    const b = baseTask({ id: 'b', dependencies: ['a'] });
    expect(isTaskBlocked(b, [a, b])).toBe(true);
  });

  it('returns false when all prerequisites are done', () => {
    const a = baseTask({ id: 'a', status: 'done' });
    const b = baseTask({ id: 'b', dependencies: ['a'] });
    expect(isTaskBlocked(b, [a, b])).toBe(false);
  });

  it('treats unknown prerequisites as blocked', () => {
    const b = baseTask({ id: 'b', dependencies: ['ghost'] });
    expect(isTaskBlocked(b, [b])).toBe(true);
  });

  it('parses JSON-string dependencies for legacy rows', () => {
    const a = baseTask({ id: 'a', status: 'todo' });
    const b = { ...baseTask({ id: 'b' }), dependencies: '["a"]' as unknown as string[] };
    expect(isTaskBlocked(b, [a, b])).toBe(true);
  });
});

describe('sortTasksRunnableFirst', () => {
  it('puts runnable tasks before blocked ones and tags them', () => {
    const a = baseTask({ id: 'a', status: 'todo', priority: 'low' });
    const b = baseTask({ id: 'b', status: 'todo', priority: 'high', dependencies: ['a'] });
    const c = baseTask({ id: 'c', status: 'todo', priority: 'medium' });
    const sorted = sortTasksRunnableFirst([b, a, c]);
    expect(sorted.map((task) => task.id)).toEqual(['c', 'a', 'b']);
    expect(sorted.find((task) => task.id === 'b')?.blocked).toBe(true);
    expect(sorted.find((task) => task.id === 'a')?.blocked).toBe(false);
  });
});

describe('findNextTask', () => {
  it('skips blocked todo tasks even if higher priority', () => {
    const a = baseTask({ id: 'a', status: 'todo', priority: 'low' });
    const b = baseTask({ id: 'b', status: 'todo', priority: 'high', dependencies: ['a'] });
    expect(findNextTask([a, b]).id).toBe('a');
  });

  it('returns the highest-priority runnable task', () => {
    const a = baseTask({ id: 'a', status: 'todo', priority: 'low', created_at: '2026-04-30T00:00:00Z' });
    const b = baseTask({ id: 'b', status: 'todo', priority: 'high', created_at: '2026-05-01T00:00:00Z' });
    const c = baseTask({ id: 'c', status: 'todo', priority: 'high', created_at: '2026-04-29T00:00:00Z' });
    expect(findNextTask([a, b, c]).id).toBe('c');
  });

  it('unblocks a task once the prerequisite is done', () => {
    const a = baseTask({ id: 'a', status: 'done' });
    const b = baseTask({ id: 'b', status: 'todo', priority: 'high', dependencies: ['a'] });
    expect(findNextTask([a, b]).id).toBe('b');
  });

  it('throws a helpful error when only blocked tasks remain', () => {
    const a = baseTask({ id: 'a', status: 'todo', priority: 'high', dependencies: ['ghost'] });
    expect(() => findNextTask([a])).toThrow(/blocked by unfinished prerequisites/i);
  });

  it('honors project filter', () => {
    const a = baseTask({ id: 'a', status: 'todo', project_slug: 'alpha' });
    const b = baseTask({ id: 'b', status: 'todo', project_slug: 'beta' });
    expect(findNextTask([a, b], { project: 'beta' }).id).toBe('b');
  });
});
