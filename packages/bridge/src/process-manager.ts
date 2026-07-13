import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import * as pty from "node-pty";
import type { IPty } from "node-pty";
import type {
  LogEntry,
  OperationName,
  ProcessPhase,
  ProcessSnapshot,
} from "@mobile-dev-cockpit/protocol";
import type { ProjectConfig } from "./config.js";

interface OwnedProcess {
  snapshot: ProcessSnapshot;
  write?: (data: string) => void;
  terminate: () => void;
  forceTimer?: NodeJS.Timeout;
}

export interface ProcessEvents {
  log: [LogEntry];
  process: [{ projectId: string; process: ProcessSnapshot }];
  preview: [{ projectId: string; url: string }];
}

const ANSI_PATTERN = /\x1B(?:[@-_]|\[[0-?]*[ -/]*[@-~])/g;
const STOP_GRACE_MS = 3_000;

function ptyEnvironment(
  environment: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...environment }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function signalChildGroup(
  child: ChildProcessWithoutNullStreams,
  signal: NodeJS.Signals,
): void {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

export class ProcessManager extends EventEmitter<ProcessEvents> {
  private readonly active = new Map<string, OwnedProcess>();
  private readonly latest = new Map<string, ProcessSnapshot>();

  constructor(private readonly logLineLimit: number) {
    super();
  }

  start(project: ProjectConfig, operation: OperationName): ProcessSnapshot {
    if (operation === "agent") return this.startAgent(project, false);
    const command = project.commands[operation];
    if (!command)
      throw new Error(`${operation} is not configured for ${project.name}`);
    return this.startChild(project, operation, command);
  }

  startAgent(project: ProjectConfig, resume: boolean): ProcessSnapshot {
    const command = resume
      ? project.commands.agentResume
      : project.commands.agent;
    if (!command)
      throw new Error(
        `${resume ? "agent resume" : "agent"} is not configured for ${project.name}`,
      );
    const key = `${project.id}:agent`;
    if (this.active.has(key)) throw new Error("agent is already running");

    const snapshot = this.createSnapshot("agent");
    let terminal: IPty;
    try {
      terminal = pty.spawn(command[0], command.slice(1), {
        name: "xterm-256color",
        cols: 100,
        rows: 30,
        cwd: project.repositoryPath,
        env: ptyEnvironment(project.environment),
      });
    } catch (error) {
      throw new Error(
        `Unable to start agent pseudoterminal: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    let remainder = "";
    const owned: OwnedProcess = {
      snapshot,
      write: (data) => terminal.write(data),
      terminate: () => {
        try {
          terminal.kill("SIGTERM");
        } catch {
          return;
        }
        owned.forceTimer ??= setTimeout(() => {
          if (!this.active.has(key)) return;
          try {
            terminal.kill("SIGKILL");
          } catch {
            // The terminal has already exited.
          }
        }, STOP_GRACE_MS);
        owned.forceTimer.unref();
      },
    };
    this.active.set(key, owned);
    this.latest.set(key, snapshot);
    this.emitProcess(project.id, snapshot);

    terminal.onData((chunk) => {
      remainder = this.consumeText(
        project.id,
        snapshot,
        "stdout",
        remainder,
        chunk,
        true,
      );
    });
    terminal.onExit(({ exitCode, signal }) => {
      if (remainder) this.appendLog(project.id, snapshot, "stdout", remainder);
      this.finish(
        project.id,
        key,
        snapshot,
        signal ? "stopped" : exitCode === 0 ? "succeeded" : "failed",
        exitCode,
        signal ? `Stopped by signal ${signal}` : `Exited with code ${exitCode}`,
      );
    });
    return structuredClone(snapshot);
  }

  stop(projectId: string, operation: OperationName): ProcessSnapshot {
    const owned = this.active.get(`${projectId}:${operation}`);
    if (!owned) throw new Error(`${operation} is not running`);
    owned.terminate();
    return structuredClone(owned.snapshot);
  }

  instruct(projectId: string, instruction: string): void {
    const owned = this.active.get(`${projectId}:agent`);
    if (!owned?.write) throw new Error("Agent is not running");
    owned.write(`${instruction}\r`);
    this.appendLog(
      projectId,
      owned.snapshot,
      "system",
      `Instruction sent (${instruction.length} characters)`,
    );
  }

  hasActiveAgent(projectId: string): boolean {
    return this.active.has(`${projectId}:agent`);
  }

  snapshots(
    projectId: string,
  ): Partial<Record<OperationName, ProcessSnapshot>> {
    const result: Partial<Record<OperationName, ProcessSnapshot>> = {};
    for (const operation of [
      "dev",
      "tunnel",
      "build",
      "test",
      "agent",
      "deploy",
      "rollback",
    ] as const) {
      const snapshot = this.latest.get(`${projectId}:${operation}`);
      if (snapshot) result[operation] = structuredClone(snapshot);
    }
    return result;
  }

  close(): void {
    for (const owned of this.active.values()) owned.terminate();
  }

  private startChild(
    project: ProjectConfig,
    operation: Exclude<OperationName, "agent">,
    command: readonly [string, ...string[]],
  ): ProcessSnapshot {
    const key = `${project.id}:${operation}`;
    if (this.active.has(key))
      throw new Error(`${operation} is already running`);
    const snapshot = this.createSnapshot(operation);
    const child = spawn(command[0], command.slice(1), {
      cwd: project.repositoryPath,
      env: { ...process.env, ...project.environment },
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdoutRemainder = "";
    let stderrRemainder = "";
    let finished = false;
    const owned: OwnedProcess = {
      snapshot,
      write: (data) => child.stdin.write(data),
      terminate: () => {
        signalChildGroup(child, "SIGTERM");
        owned.forceTimer ??= setTimeout(() => {
          if (this.active.has(key)) signalChildGroup(child, "SIGKILL");
        }, STOP_GRACE_MS);
        owned.forceTimer.unref();
      },
    };
    const finish = (
      phase: ProcessPhase,
      exitCode: number | undefined,
      reason: string,
    ): void => {
      if (finished) return;
      finished = true;
      if (stdoutRemainder)
        this.appendLog(project.id, snapshot, "stdout", stdoutRemainder);
      if (stderrRemainder)
        this.appendLog(project.id, snapshot, "stderr", stderrRemainder);
      this.finish(project.id, key, snapshot, phase, exitCode, reason);
    };

    this.active.set(key, owned);
    this.latest.set(key, snapshot);
    this.emitProcess(project.id, snapshot);
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutRemainder = this.consumeText(
        project.id,
        snapshot,
        "stdout",
        stdoutRemainder,
        chunk.toString("utf8"),
      );
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrRemainder = this.consumeText(
        project.id,
        snapshot,
        "stderr",
        stderrRemainder,
        chunk.toString("utf8"),
      );
    });
    child.on("error", (error) => finish("failed", undefined, error.message));
    child.on("exit", (code, signal) => {
      finish(
        signal ? "stopped" : code === 0 ? "succeeded" : "failed",
        code ?? undefined,
        signal
          ? `Stopped by ${signal}`
          : `Exited with code ${code ?? "unknown"}`,
      );
    });
    return structuredClone(snapshot);
  }

  private createSnapshot(operation: OperationName): ProcessSnapshot {
    return {
      operation,
      phase: "running",
      startedAt: new Date().toISOString(),
      recentLogs: [],
    };
  }

  private consumeText(
    projectId: string,
    snapshot: ProcessSnapshot,
    stream: "stdout" | "stderr",
    remainder: string,
    chunk: string,
    stripAnsi = false,
  ): string {
    const text = stripAnsi
      ? `${remainder}${chunk}`.replace(ANSI_PATTERN, "")
      : `${remainder}${chunk}`;
    const parts = text.split(/\r\n|\n|\r/);
    const tail = parts.pop() ?? "";
    for (const line of parts) {
      if (line) this.appendLog(projectId, snapshot, stream, line);
    }
    return tail;
  }

  private finish(
    projectId: string,
    key: string,
    snapshot: ProcessSnapshot,
    phase: ProcessPhase,
    exitCode: number | undefined,
    reason: string,
  ): void {
    const owned = this.active.get(key);
    if (owned?.forceTimer) clearTimeout(owned.forceTimer);
    this.active.delete(key);
    snapshot.finishedAt = new Date().toISOString();
    snapshot.exitCode = exitCode;
    snapshot.phase = phase;
    this.appendLog(projectId, snapshot, "system", reason);
    this.emitProcess(projectId, snapshot);
  }

  private appendLog(
    projectId: string,
    snapshot: ProcessSnapshot,
    stream: LogEntry["stream"],
    line: string,
  ): void {
    const entry: LogEntry = {
      projectId,
      operation: snapshot.operation,
      stream,
      line: line.slice(0, 10_000),
      timestamp: new Date().toISOString(),
    };
    snapshot.recentLogs.push(entry);
    if (snapshot.recentLogs.length > this.logLineLimit) {
      snapshot.recentLogs.splice(
        0,
        snapshot.recentLogs.length - this.logLineLimit,
      );
    }
    this.emit("log", structuredClone(entry));
    if (snapshot.operation === "dev" || snapshot.operation === "tunnel") {
      const match = line.match(/https?:\/\/[^\s<>"']+/i);
      if (match)
        this.emit("preview", {
          projectId,
          url: match[0].replace(/[),.;]+$/, ""),
        });
    }
  }

  private emitProcess(projectId: string, snapshot: ProcessSnapshot): void {
    this.emit("process", { projectId, process: structuredClone(snapshot) });
  }
}
