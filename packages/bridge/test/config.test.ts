import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("bridge config", () => {
  const repositoryPath = mkdtempSync(join(tmpdir(), "cockpit-config-"));

  it("canonicalizes an allowlisted repository and argv commands", () => {
    const config = parseConfig(
      {
        machineName: "Test Mac",
        projects: [
          {
            id: "site",
            name: "Site",
            repositoryPath,
            commands: { dev: ["node", "server.js"] },
          },
        ],
      },
      join(repositoryPath, "config.json"),
    );
    expect(config.host).toBe("127.0.0.1");
    expect(config.projects[0]?.commands.dev).toEqual(["node", "server.js"]);
  });

  it("rejects relative repository paths and shell strings", () => {
    expect(() =>
      parseConfig(
        {
          machineName: "Test",
          projects: [
            {
              id: "site",
              name: "Site",
              repositoryPath: ".",
              commands: { dev: ["node"] },
            },
          ],
        },
        "/tmp/config.json",
      ),
    ).toThrow(/must be absolute/);
    expect(() =>
      parseConfig(
        {
          machineName: "Test",
          projects: [
            {
              id: "site",
              name: "Site",
              repositoryPath,
              commands: { dev: "npm run dev" },
            },
          ],
        },
        "/tmp/config.json",
      ),
    ).toThrow(/argv string array/);
  });

  it("bounds credential and approval lifetimes", () => {
    expect(() =>
      parseConfig(
        {
          machineName: "Test",
          sessionTtlSeconds: 604_801,
          projects: [
            {
              id: "site",
              name: "Site",
              repositoryPath,
              commands: { dev: ["node"] },
            },
          ],
        },
        "/tmp/config.json",
      ),
    ).toThrow(/sessionTtlSeconds must be at most/);
  });
});
