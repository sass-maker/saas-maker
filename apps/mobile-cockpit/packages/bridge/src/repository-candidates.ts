import { createHash } from "node:crypto";
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import type {
  CandidateOperation,
  CandidateRisk,
  CommandCandidate,
} from "@mobile-dev-cockpit/protocol";
import type { CommandMap } from "./config.js";
import type { RepositoryDetails } from "./discover.js";

export interface InternalCandidate extends CommandCandidate {
  argv: readonly [string, ...string[]];
}

const scriptOperations: Record<string, CandidateOperation> = {
  dev: "dev",
  start: "dev",
  tunnel: "tunnel",
  build: "build",
  test: "test",
  check: "test",
  deploy: "deploy",
  rollback: "rollback",
};

function bounded(value: string, maximum = 2_000): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum)}…`;
}

function candidateId(
  repositoryId: string,
  operation: CandidateOperation,
  argv: readonly string[],
  scriptBody = "",
): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([repositoryId, operation, argv, scriptBody]))
    .digest("base64url")
    .slice(0, 18);
  return `cmd_${digest}`;
}

function argvLabel(argv: readonly string[]): string {
  return argv.map((part) => JSON.stringify(part)).join(" ");
}

function installed(command: string): boolean {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    try {
      accessSync(join(directory, command), constants.X_OK);
      return true;
    } catch {
      // Continue without disclosing candidate executable paths.
    }
  }
  return false;
}

function addCandidate(
  candidates: InternalCandidate[],
  repositoryId: string,
  operation: CandidateOperation,
  label: string,
  argv: readonly [string, ...string[]],
  source: CommandCandidate["source"],
  risk: CandidateRisk,
  scriptBody?: string,
): void {
  candidates.push({
    id: candidateId(repositoryId, operation, argv, scriptBody),
    operation,
    label,
    argvLabel: argvLabel(argv),
    source,
    risk,
    ...(scriptBody ? { scriptBody: bounded(scriptBody) } : {}),
    argv,
  });
}

function packageArgv(
  manager: NonNullable<RepositoryDetails["packageManager"]>,
  script: string,
): readonly [string, ...string[]] {
  if (manager === "yarn") return ["yarn", script];
  return [manager, "run", script];
}

function manifestCandidates(
  repository: RepositoryDetails,
): InternalCandidate[] {
  const path = join(repository.repositoryPath, ".mobile-dev-cockpit.json");
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    throw new Error(".mobile-dev-cockpit.json must be an object");
  const allowedRootKeys = new Set(["commands"]);
  const unknownRoot = Object.keys(raw).find((key) => !allowedRootKeys.has(key));
  if (unknownRoot)
    throw new Error(`Unknown repository manifest field: ${unknownRoot}`);
  const commands = (raw as { commands?: unknown }).commands;
  if (
    typeof commands !== "object" ||
    commands === null ||
    Array.isArray(commands)
  )
    throw new Error("Repository manifest commands must be an object");
  const allowed = new Set<CandidateOperation>([
    "dev",
    "tunnel",
    "build",
    "test",
    "agent",
    "agentResume",
    "deploy",
    "rollback",
  ]);
  const result: InternalCandidate[] = [];
  for (const [operation, value] of Object.entries(commands)) {
    if (!allowed.has(operation as CandidateOperation))
      throw new Error(`Unknown repository manifest command: ${operation}`);
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.length > 32 ||
      value.some(
        (part) =>
          typeof part !== "string" || part.length === 0 || part.length > 4_096,
      )
    )
      throw new Error(
        `Manifest command ${operation} must be a bounded argv array`,
      );
    addCandidate(
      result,
      repository.id,
      operation as CandidateOperation,
      `Custom ${operation}`,
      value as [string, ...string[]],
      "manifest",
      "guarded",
    );
  }
  return result;
}

export function detectCommandCandidates(
  repository: RepositoryDetails,
): InternalCandidate[] {
  const candidates: InternalCandidate[] = [];
  if (repository.packageManager) {
    try {
      const manifest = JSON.parse(
        readFileSync(join(repository.repositoryPath, "package.json"), "utf8"),
      ) as { scripts?: unknown };
      if (
        manifest.scripts &&
        typeof manifest.scripts === "object" &&
        !Array.isArray(manifest.scripts)
      ) {
        for (const [script, body] of Object.entries(manifest.scripts)) {
          const operation = scriptOperations[script];
          if (!operation || typeof body !== "string") continue;
          const risk: CandidateRisk = ["deploy", "rollback"].includes(operation)
            ? "guarded"
            : operation === "dev" || operation === "test"
              ? "routine"
              : "review";
          addCandidate(
            candidates,
            repository.id,
            operation,
            `${script} package script`,
            packageArgv(repository.packageManager, script),
            "package",
            risk,
            body,
          );
        }
      }
    } catch {
      // Malformed Node metadata yields no package candidates.
    }
  }
  if (installed("codex")) {
    addCandidate(
      candidates,
      repository.id,
      "agent",
      "Codex new session",
      ["codex"],
      "agent",
      "review",
    );
    addCandidate(
      candidates,
      repository.id,
      "agentResume",
      "Codex resume",
      ["codex", "resume", "--last"],
      "agent",
      "review",
    );
  }
  if (installed("claude")) {
    addCandidate(
      candidates,
      repository.id,
      "agent",
      "Claude Code new session",
      ["claude"],
      "agent",
      "review",
    );
    addCandidate(
      candidates,
      repository.id,
      "agentResume",
      "Claude Code continue",
      ["claude", "--continue"],
      "agent",
      "review",
    );
  }
  return [...candidates, ...manifestCandidates(repository)].slice(0, 24);
}

export function commandsFromCandidates(
  candidates: InternalCandidate[],
): CommandMap {
  const commands: CommandMap = {};
  for (const candidate of candidates) {
    if (commands[candidate.operation])
      throw new Error(`Select only one ${candidate.operation} candidate`);
    commands[candidate.operation] = candidate.argv;
  }
  return commands;
}

export function metadataFingerprint(repositoryPath: string): string {
  const hash = createHash("sha256");
  for (const name of [
    "package.json",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    ".mobile-dev-cockpit.json",
  ]) {
    const path = join(repositoryPath, name);
    hash.update(name);
    if (!existsSync(path)) {
      hash.update("missing");
      continue;
    }
    const value = readFileSync(path);
    hash.update(value.subarray(0, 256_000));
    hash.update(String(value.length));
  }
  return hash.digest("base64url");
}
