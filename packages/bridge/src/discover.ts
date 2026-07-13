import { readdirSync, realpathSync, statSync } from "node:fs";
import { basename, join } from "node:path";

export interface DiscoveredRepository {
  name: string;
  repositoryPath: string;
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
      return;
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
