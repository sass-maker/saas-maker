import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../src/config.js";
import {
  commitStaged,
  getReview,
  revertFile,
  stageFile,
  unstageFile,
} from "../src/review.js";

function fixture(): ProjectConfig {
  const repositoryPath = mkdtempSync(join(tmpdir(), "cockpit-review-"));
  execFileSync("git", ["init", "-q"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: repositoryPath,
  });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: repositoryPath });
  writeFileSync(join(repositoryPath, "tracked.txt"), "before\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: repositoryPath });
  writeFileSync(
    join(repositoryPath, "tracked.txt"),
    `after\n${"x".repeat(2_000)}\n`,
  );
  return {
    id: "site",
    name: "Site",
    repositoryPath,
    environment: {},
    commands: {},
  };
}

describe("getReview", () => {
  it("returns changed files and marks bounded diffs", () => {
    const review = getReview(fixture(), 300);
    expect(review.files).toContain("tracked.txt");
    expect(Buffer.byteLength(review.diff)).toBeLessThanOrEqual(300);
    expect(review.truncated).toBe(true);
  });

  it("stages, unstages, and commits only reviewed changes", () => {
    const project = fixture();
    expect(stageFile(project, "tracked.txt", 10_000).stagedFiles).toContain(
      "tracked.txt",
    );
    expect(
      unstageFile(project, "tracked.txt", 10_000).stagedFiles,
    ).not.toContain("tracked.txt");
    stageFile(project, "tracked.txt", 10_000);
    expect(
      commitStaged(project, "Update tracked fixture", 10_000).files,
    ).not.toContain("tracked.txt");
  });

  it("reverts tracked files but refuses to delete untracked files", () => {
    const project = fixture();
    writeFileSync(join(project.repositoryPath, "untracked.txt"), "keep me");
    expect(() => revertFile(project, "untracked.txt", 10_000)).toThrow(
      /cannot be deleted/,
    );
    expect(existsSync(join(project.repositoryPath, "untracked.txt"))).toBe(
      true,
    );
    expect(revertFile(project, "tracked.txt", 10_000).files).not.toContain(
      "tracked.txt",
    );
  });
});
