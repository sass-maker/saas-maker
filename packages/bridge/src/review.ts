import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import { sep, resolve } from "node:path";
import type { ReviewResult } from "@mobile-dev-cockpit/protocol";
import type { ProjectConfig } from "./config.js";

function git(repositoryPath: string, args: string[], limit: number): string {
  const result = spawnSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
    maxBuffer: Math.max(limit * 2, 1_000_000),
    timeout: 15_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error((result.stderr || "Git command failed").trim());
  return result.stdout;
}

function gitBounded(
  repositoryPath: string,
  args: string[],
  limit: number,
): string {
  const result = spawnSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
    maxBuffer: limit + 64 * 1024,
    timeout: 15_000,
  });
  if (
    result.error &&
    (result.error as NodeJS.ErrnoException).code !== "ENOBUFS"
  )
    throw result.error;
  if (!result.error && result.status !== 0)
    throw new Error((result.stderr || "Git command failed").trim());
  return result.stdout ?? "";
}

interface StatusEntry {
  path: string;
  staged: boolean;
  untracked: boolean;
}

function statusEntries(
  project: ProjectConfig,
  byteLimit: number,
): StatusEntry[] {
  const records = git(
    project.repositoryPath,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    byteLimit,
  ).split("\0");
  const entries: StatusEntry[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.length < 4) continue;
    const code = record.slice(0, 2);
    entries.push({
      path: record.slice(3),
      staged: code[0] !== " " && code[0] !== "?",
      untracked: code === "??",
    });
    if (/[RC]/.test(code)) index += 1;
  }
  return entries;
}

function safeChangedFile(
  project: ProjectConfig,
  file: string,
  byteLimit: number,
): StatusEntry {
  if (!file || file.includes("\0")) throw new Error("Invalid file path");
  const absolute = resolve(project.repositoryPath, file);
  if (
    absolute !== project.repositoryPath &&
    !absolute.startsWith(`${project.repositoryPath}${sep}`)
  ) {
    throw new Error("File is outside the configured repository");
  }
  const entry = statusEntries(project, byteLimit).find(
    (candidate) => candidate.path === file,
  );
  if (!entry) throw new Error("File is not in the current Git change set");
  return entry;
}

export function getReview(
  project: ProjectConfig,
  byteLimit: number,
): ReviewResult {
  const entries = statusEntries(project, byteLimit).slice(0, 1_000);
  const combined = [
    gitBounded(
      project.repositoryPath,
      ["diff", "--no-ext-diff", "--"],
      byteLimit,
    ),
    gitBounded(
      project.repositoryPath,
      ["diff", "--cached", "--no-ext-diff", "--"],
      byteLimit,
    ),
  ]
    .filter(Boolean)
    .join("\n");
  const encoded = Buffer.from(combined, "utf8");
  const truncated = encoded.byteLength > byteLimit;
  return {
    projectId: project.id,
    files: entries.map((entry) => entry.path),
    stagedFiles: entries
      .filter((entry) => entry.staged)
      .map((entry) => entry.path),
    untrackedFiles: entries
      .filter((entry) => entry.untracked)
      .map((entry) => entry.path),
    diff: truncated
      ? encoded.subarray(0, byteLimit).toString("utf8")
      : combined,
    truncated,
  };
}

export function stageFile(
  project: ProjectConfig,
  file: string,
  byteLimit: number,
): ReviewResult {
  safeChangedFile(project, file, byteLimit);
  git(project.repositoryPath, ["add", "--", file], byteLimit);
  return getReview(project, byteLimit);
}

export function unstageFile(
  project: ProjectConfig,
  file: string,
  byteLimit: number,
): ReviewResult {
  const entry = safeChangedFile(project, file, byteLimit);
  if (!entry.staged) throw new Error("File is not staged");
  git(project.repositoryPath, ["restore", "--staged", "--", file], byteLimit);
  return getReview(project, byteLimit);
}

export function revertFile(
  project: ProjectConfig,
  file: string,
  byteLimit: number,
): ReviewResult {
  const entry = safeChangedFile(project, file, byteLimit);
  if (entry.untracked)
    throw new Error(
      "Untracked files cannot be deleted from Mobile Dev Cockpit",
    );
  git(project.repositoryPath, ["restore", "--worktree", "--", file], byteLimit);
  return getReview(project, byteLimit);
}

export function commitStaged(
  project: ProjectConfig,
  message: string,
  byteLimit: number,
): ReviewResult {
  const entries = statusEntries(project, byteLimit);
  if (!entries.some((entry) => entry.staged))
    throw new Error("No staged changes to commit");
  git(project.repositoryPath, ["commit", "-m", message], byteLimit);
  return getReview(project, byteLimit);
}

export function stagedFingerprint(
  project: ProjectConfig,
  byteLimit: number,
): string {
  const entries = statusEntries(project, byteLimit);
  if (!entries.some((entry) => entry.staged))
    throw new Error("No staged changes to commit");
  return git(project.repositoryPath, ["write-tree"], byteLimit).trim();
}

export function worktreeFingerprint(
  project: ProjectConfig,
  file: string,
  byteLimit: number,
): string {
  const entry = safeChangedFile(project, file, byteLimit);
  if (entry.untracked)
    throw new Error(
      "Untracked files cannot be deleted from Mobile Dev Cockpit",
    );
  const digest = createHash("sha256").update(file).update("\0");
  const path = resolve(project.repositoryPath, file);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, "r");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let bytesRead = 0;
    do {
      bytesRead = readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) digest.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    digest.update("<deleted>");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return digest.digest("hex");
}
