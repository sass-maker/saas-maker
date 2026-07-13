import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  discoverRepositories,
  discoverRepositoryDetails,
} from "../src/discover.js";

describe("discoverRepositories", () => {
  it("finds Git roots without treating them as controllable config", () => {
    const root = mkdtempSync(join(tmpdir(), "cockpit-discover-"));
    const repository = join(root, "products", "site");
    mkdirSync(join(repository, ".git"), { recursive: true });
    writeFileSync(join(repository, "README.md"), "# fixture");
    expect(discoverRepositories([root])).toEqual([
      { name: "site", repositoryPath: realpathSync(repository) },
    ]);
  });

  it("continues through a Git workspace root to find nested repositories", () => {
    const root = mkdtempSync(join(tmpdir(), "cockpit-workspace-"));
    const repository = join(root, "products", "site");
    mkdirSync(join(root, ".git"));
    mkdirSync(join(repository, ".git"), { recursive: true });

    expect(discoverRepositories([root])).toEqual([
      { name: basename(root), repositoryPath: realpathSync(root) },
      { name: "site", repositoryPath: realpathSync(repository) },
    ]);
  });

  it("returns only safe relative metadata for authenticated discovery surfaces", () => {
    const root = mkdtempSync(join(tmpdir(), "cockpit-details-"));
    const repository = join(root, "products", "site");
    mkdirSync(join(repository, ".git"), { recursive: true });
    writeFileSync(
      join(repository, "package.json"),
      JSON.stringify({ packageManager: "pnpm@10.0.0" }),
    );
    const [details] = discoverRepositoryDetails([root]);
    expect(details).toMatchObject({
      name: "site",
      relativeLocation: join("products", "site"),
      ecosystem: "node",
      packageManager: "pnpm",
      enrollment: "available",
    });
    expect(details?.id).toMatch(/^repo_/);
  });
});
