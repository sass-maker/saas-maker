import type { CommandCandidate } from "@mobile-dev-cockpit/protocol";

export function defaultCandidateSelection(
  candidates: CommandCandidate[],
): string[] {
  const operations = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (candidate.risk === "guarded" || operations.has(candidate.operation))
      return [];
    operations.add(candidate.operation);
    return [candidate.id];
  });
}

export function toggleCandidateSelection(
  current: string[],
  candidate: CommandCandidate,
  candidates: CommandCandidate[],
): string[] {
  if (current.includes(candidate.id))
    return current.filter((id) => id !== candidate.id);
  const sameOperation = new Set(
    candidates
      .filter((item) => item.operation === candidate.operation)
      .map((item) => item.id),
  );
  return [...current.filter((id) => !sameOperation.has(id)), candidate.id];
}
