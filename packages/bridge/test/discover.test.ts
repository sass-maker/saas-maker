import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverRepositories } from "../src/discover.js";

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
});
