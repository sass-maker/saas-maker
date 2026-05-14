export interface PrGatePatch {
  patchBytes: number;
  status: string;
  stat: string;
}

export interface PrGateEvidence {
  filesChanged: string[];
  checkCommands: string[];
  meaningful: boolean;
}

export function collectPrGateEvidence(patch: PrGatePatch): PrGateEvidence {
  const filesChanged = changedFilesFromStatus(patch.status);
  const statFiles = changedFilesFromStat(patch.stat);
  const merged = Array.from(new Set([...filesChanged, ...statFiles])).sort();
  return {
    filesChanged: merged,
    checkCommands: ['git diff --check -- .'],
    meaningful: patch.patchBytes > 0 && merged.length > 0,
  };
}

export function changedFilesFromStatus(status: string): string[] {
  return status
    .split('\n')
    .map((line) => (line.length > 3 ? line.slice(3).trim() : line.trim()))
    .filter(Boolean)
    .map((line) => line.split(' -> ').at(-1)?.trim() ?? line)
    .filter(Boolean);
}

export function changedFilesFromStat(stat: string): string[] {
  return stat
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('|'))
    .map((line) => line.split('|')[0]?.trim())
    .filter((file): file is string => Boolean(file));
}

export function buildFinalReport(input: {
  summary: string;
  filesChanged: string[];
  checksRun: string[];
  prUrl?: string | null;
  prBranch?: string | null;
  nextAction?: string | null;
  blockers?: string[];
  risks?: string[];
}) {
  return {
    summary: input.summary,
    files_changed: input.filesChanged,
    checks_run: input.checksRun,
    pr_url: input.prUrl ?? null,
    pr_branch: input.prBranch ?? null,
    next_action: input.nextAction ?? null,
    blockers: input.blockers ?? [],
    risks: input.risks ?? [],
  };
}
