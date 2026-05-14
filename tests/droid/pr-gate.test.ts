import { describe, expect, it } from 'vitest';
import {
  buildFinalReport,
  changedFilesFromStat,
  changedFilesFromStatus,
  collectPrGateEvidence,
} from '../../workers/droid/src/pr-gate';

describe('droid pr gate helpers', () => {
  it('extracts changed files from git status and stat output', () => {
    expect(changedFilesFromStatus(' M README.md\nR  old.ts -> src/new.ts\n?? docs/note.md\n')).toEqual([
      'README.md',
      'src/new.ts',
      'docs/note.md',
    ]);
    expect(changedFilesFromStat(' README.md | 1 +\n src/new.ts | 4 ++--\n')).toEqual([
      'README.md',
      'src/new.ts',
    ]);
  });

  it('requires bytes and changed files for meaningful PR evidence', () => {
    expect(
      collectPrGateEvidence({
        patchBytes: 128,
        status: ' M README.md\n',
        stat: ' README.md | 1 +\n',
      })
    ).toEqual({
      filesChanged: ['README.md'],
      checkCommands: ['git diff --check -- .'],
      meaningful: true,
    });

    expect(collectPrGateEvidence({ patchBytes: 128, status: '', stat: '' }).meaningful).toBe(
      false
    );
  });

  it('builds a structured final report payload', () => {
    expect(
      buildFinalReport({
        summary: 'Changed audit log UI.',
        filesChanged: ['apps/cockpit/a.tsx'],
        checksRun: ['git diff --check -- .'],
        prUrl: 'https://github.com/example/repo/pull/1',
        prBranch: 'droid/run-123',
        nextAction: 'Review the draft PR.',
      })
    ).toMatchObject({
      summary: 'Changed audit log UI.',
      files_changed: ['apps/cockpit/a.tsx'],
      checks_run: ['git diff --check -- .'],
      pr_url: 'https://github.com/example/repo/pull/1',
      pr_branch: 'droid/run-123',
      next_action: 'Review the draft PR.',
      blockers: [],
      risks: [],
    });
  });
});
