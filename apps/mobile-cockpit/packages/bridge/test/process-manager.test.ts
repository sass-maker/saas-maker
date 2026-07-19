import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../src/config.js";
import { ProcessManager } from "../src/process-manager.js";

describe("ProcessManager", () => {
  it("detects a preview URL from development output", async () => {
    const project: ProjectConfig = {
      id: "site",
      name: "Site",
      repositoryPath: mkdtempSync(join(tmpdir(), "cockpit-process-")),
      environment: {},
      commands: {
        dev: [
          process.execPath,
          "-e",
          'console.log("Local: http://127.0.0.1:5173/")',
        ],
      },
    };
    const manager = new ProcessManager(20);
    const detected = new Promise<{ projectId: string; url: string }>(
      (resolve) => manager.once("preview", resolve),
    );
    manager.start(project, "dev");
    await expect(detected).resolves.toEqual({
      projectId: "site",
      url: "http://127.0.0.1:5173/",
    });
    manager.close();
  });

  it("runs new and resume agent commands in a writable pseudoterminal", async () => {
    const project: ProjectConfig = {
      id: "site",
      name: "Site",
      repositoryPath: mkdtempSync(join(tmpdir(), "cockpit-pty-")),
      environment: {},
      commands: {
        agent: [
          process.execPath,
          "-e",
          'process.stdin.once("data", d => { console.log("new:" + d.toString().trim()); process.exit(0); })',
        ],
        agentResume: [process.execPath, "-e", 'console.log("resumed")'],
      },
    };
    const manager = new ProcessManager(50);
    const newOutput = waitForLog(manager, (line) => line.includes("new:hello"));
    const newExit = waitForProcess(manager, "succeeded");
    manager.startAgent(project, false);
    manager.instruct(project.id, "hello");
    await expect(newOutput).resolves.toContain("new:hello");
    await newExit;

    const resumed = waitForLog(manager, (line) => line.includes("resumed"));
    manager.startAgent(project, true);
    await expect(resumed).resolves.toContain("resumed");
    manager.close();
  });

  it("stops the complete owned child process group", async () => {
    const repositoryPath = mkdtempSync(join(tmpdir(), "cockpit-group-"));
    const sentinel = join(repositoryPath, "orphan.txt");
    const childSource = `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(sentinel)}, 'orphan'), 700)`;
    const parentSource = `const { spawn } = require('child_process'); spawn(process.execPath, ['-e', ${JSON.stringify(childSource)}], { stdio: 'ignore' }); console.log('parent-ready'); setInterval(() => {}, 1000);`;
    const project: ProjectConfig = {
      id: "site",
      name: "Site",
      repositoryPath,
      environment: {},
      commands: { dev: [process.execPath, "-e", parentSource] },
    };
    const manager = new ProcessManager(20);
    const ready = waitForLog(manager, (line) => line === "parent-ready");
    manager.start(project, "dev");
    await ready;
    manager.stop(project.id, "dev");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect(existsSync(sentinel)).toBe(false);
    manager.close();
  });
});

function waitForLog(
  manager: ProcessManager,
  predicate: (line: string) => boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      manager.off("log", listener);
      reject(new Error("Timed out waiting for log"));
    }, 3_000);
    const listener = (entry: { line: string }): void => {
      if (!predicate(entry.line)) return;
      clearTimeout(timeout);
      manager.off("log", listener);
      resolve(entry.line);
    };
    manager.on("log", listener);
  });
}

function waitForProcess(manager: ProcessManager, phase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      manager.off("process", listener);
      reject(new Error("Timed out waiting for process state"));
    }, 3_000);
    const listener = ({ process }: { process: { phase: string } }): void => {
      if (process.phase !== phase) return;
      clearTimeout(timeout);
      manager.off("process", listener);
      resolve();
    };
    manager.on("process", listener);
  });
}
