import { describe, expect, it } from "vitest";
import type { ProcessSnapshot } from "@mobile-dev-cockpit/protocol";
import { deploymentRefreshKey } from "../src/lib/project-view";

function deployProcess(
  phase: ProcessSnapshot["phase"],
  finishedAt?: string,
): ProcessSnapshot {
  return {
    operation: "deploy",
    phase,
    finishedAt,
    recentLogs: [],
  };
}

describe("deploymentRefreshKey", () => {
  it("refreshes after each successful deployment", () => {
    expect(
      deploymentRefreshKey(deployProcess("succeeded", "2026-07-13T08:00:00Z")),
    ).toBe("2026-07-13T08:00:00Z");
    expect(
      deploymentRefreshKey(deployProcess("succeeded", "2026-07-13T09:00:00Z")),
    ).toBe("2026-07-13T09:00:00Z");
  });

  it("does not refresh for running, failed, or stopped deployments", () => {
    for (const phase of ["running", "failed", "stopped"] as const) {
      expect(deploymentRefreshKey(deployProcess(phase))).toBe("initial");
    }
  });
});
