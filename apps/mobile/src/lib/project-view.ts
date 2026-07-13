import type { ProcessSnapshot } from "@mobile-dev-cockpit/protocol";

export function deploymentRefreshKey(
  process: ProcessSnapshot | undefined,
): string {
  if (process?.phase !== "succeeded") return "initial";
  return process.finishedAt ?? "succeeded";
}
