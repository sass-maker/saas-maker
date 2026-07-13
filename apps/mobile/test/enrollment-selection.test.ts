import { describe, expect, it } from "vitest";
import type { CommandCandidate } from "@mobile-dev-cockpit/protocol";
import {
  defaultCandidateSelection,
  toggleCandidateSelection,
} from "../src/lib/enrollment-selection";

const candidates: CommandCandidate[] = [
  {
    id: "dev-primary",
    operation: "dev",
    label: "dev",
    argvLabel: '"pnpm" "run" "dev"',
    source: "package",
    risk: "routine",
  },
  {
    id: "dev-alternate",
    operation: "dev",
    label: "start",
    argvLabel: '"pnpm" "run" "start"',
    source: "package",
    risk: "routine",
  },
  {
    id: "deploy",
    operation: "deploy",
    label: "deploy",
    argvLabel: '"pnpm" "run" "deploy"',
    source: "package",
    risk: "guarded",
  },
];

describe("candidate selection", () => {
  it("defaults to one non-guarded candidate per operation", () => {
    expect(defaultCandidateSelection(candidates)).toEqual(["dev-primary"]);
  });

  it("replaces, rather than duplicates, candidates for the same operation", () => {
    expect(
      toggleCandidateSelection(["dev-primary"], candidates[1]!, candidates),
    ).toEqual(["dev-alternate"]);
  });
});
