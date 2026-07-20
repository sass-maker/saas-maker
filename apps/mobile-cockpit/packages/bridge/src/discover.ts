import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { basename, join, relative, sep } from "node:path";
import type { RepositorySummary } from "@mobile-dev-cockpit/protocol";

export interface DiscoveredRepository {
  name: string;
  repositoryPath: string;
}

export interface RepositoryDetails extends RepositorySummary {
  repositoryPath: string;
  discoveryRoot: string;
}

const skipped = new Set([
  "node_modules",
  "dist",
  "build",
  ".cache",
  ".expo",
  "Library",
]);

export function discoverRepositories(
  roots: string[],
  maxDepth = 3,
): DiscoveredRepository[] {
  const found = new Map<string, DiscoveredRepository>();

  const visit = (directory: string, depth: number): void => {
    if (found.size >= 200 || depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.name === ".git")) {
      const repositoryPath = realpathSync(directory);
      found.set(repositoryPath, {
        name: basename(repositoryPath),
        repositoryPath,
      });
    }
    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        skipped.has(entry.name)
      )
        continue;
      if (entry.name.startsWith(".") && entry.name !== ".") continue;
      visit(join(directory, entry.name), depth + 1);
    }
  };

  for (const root of roots) {
    const canonical = realpathSync(root);
    if (!statSync(canonical).isDirectory())
      throw new Error(`Discovery root is not a directory: ${root}`);
    visit(canonical, 0);
  }
  return [...found.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function packageManager(
  repositoryPath: string,
): RepositorySummary["packageManager"] {
  try {
    const manifest = JSON.parse(
      readFileSync(join(repositoryPath, "package.json"), "utf8"),
    ) as {
      packageManager?: unknown;
    };
    if (typeof manifest.packageManager === "string") {
      const manager = manifest.packageManager.split("@")[0];
      if (["pnpm", "npm", "yarn", "bun"].includes(manager ?? ""))
        return manager as RepositorySummary["packageManager"];
    }
  } catch {
    // Lockfile detection below is enough when package.json is absent or malformed.
  }
  if (existsSync(join(repositoryPath, "pnpm-lock.yaml"))) return "pnpm";
  if (
    existsSync(join(repositoryPath, "bun.lock")) ||
    existsSync(join(repositoryPath, "bun.lockb"))
  )
    return "bun";
  if (existsSync(join(repositoryPath, "yarn.lock"))) return "yarn";
  if (existsSync(join(repositoryPath, "package-lock.json"))) return "npm";
  return existsSync(join(repositoryPath, "package.json")) ? "npm" : undefined;
}

function repositoryId(repositoryPath: string): string {
  return `repo_${createHash("sha256").update(repositoryPath).digest("base64url").slice(0, 18)}`;
}

export function discoverRepositoryDetails(
  roots: string[],
  enrolled: ReadonlyMap<string, string> = new Map(),
  maxDepth = 3,
): RepositoryDetails[] {
  const canonicalRoots = roots.map((root) => realpathSync(root));
  return discoverRepositories(canonicalRoots, maxDepth).map((repository) => {
    const discoveryRoot = canonicalRoots.find((root) => {
      const location = relative(root, repository.repositoryPath);
      return (
        location === "" ||
        (!location.startsWith(`..${sep}`) && location !== "..")
      );
    });
    if (!discoveryRoot)
      throw new Error("Discovered repository escaped its root");
    const relativeLocation =
      relative(discoveryRoot, repository.repositoryPath) || ".";
    const manager = packageManager(repository.repositoryPath);
    const enrolledProjectId = enrolled.get(repository.repositoryPath);
    return {
      id: repositoryId(repository.repositoryPath),
      name: repository.name,
      relativeLocation,
      ecosystem: manager ? "node" : "unknown",
      ...(manager ? { packageManager: manager } : {}),
      enrollment: enrolledProjectId ? "enrolled" : "available",
      ...(enrolledProjectId ? { enrolledProjectId } : {}),
      repositoryPath: repository.repositoryPath,
      discoveryRoot,
    };
  });
}
