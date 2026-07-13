import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PROTOCOL_VERSION,
  type ClientRequest,
  type ServerResponse,
} from "@mobile-dev-cockpit/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { BridgeConfig } from "../src/config.js";
import { BridgeServer } from "../src/server.js";

const servers: BridgeServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function fixture(): BridgeConfig {
  const repositoryPath = mkdtempSync(join(tmpdir(), "cockpit-server-"));
  execFileSync("git", ["init", "-q"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.email", "test@example.com"], {
    cwd: repositoryPath,
  });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: repositoryPath });
  writeFileSync(join(repositoryPath, "file.txt"), "before\n");
  execFileSync("git", ["add", "file.txt"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: repositoryPath });
  writeFileSync(join(repositoryPath, "file.txt"), "after\n");
  return {
    machineName: "Test Mac",
    host: "127.0.0.1",
    port: 0,
    pairingTtlSeconds: 60,
    sessionTtlSeconds: 86_400,
    approvalTtlSeconds: 60,
    logLineLimit: 100,
    diffByteLimit: 10_000,
    stateFile: join(repositoryPath, ".state", "state.json"),
    projects: [
      {
        id: "site",
        name: "Site",
        repositoryPath,
        previewUrl: "http://localhost:3000/",
        productionUrl: "https://example.com/",
        environment: {},
        commands: {
          dev: [
            process.execPath,
            "-e",
            'console.log("ready"); setInterval(() => {}, 1000)',
          ],
          build: [process.execPath, "-e", 'console.log("built")'],
          agent: [
            process.execPath,
            "-e",
            'process.stdin.on("data", d => console.log("agent:" + d.toString().trim())); setInterval(() => {}, 1000)',
          ],
          agentResume: [
            process.execPath,
            "-e",
            'console.log("resumed"); setInterval(() => {}, 1000)',
          ],
          deploy: [process.execPath, "-e", 'console.log("deployed")'],
        },
      },
    ],
  };
}

function open(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function request(
  socket: WebSocket,
  message: ClientRequest,
): Promise<ServerResponse> {
  return new Promise((resolve) => {
    const listener = (data: WebSocket.RawData): void => {
      const response = JSON.parse(data.toString()) as ServerResponse;
      if (
        response.type === "response" &&
        response.requestId === message.requestId
      ) {
        socket.off("message", listener);
        resolve(response);
      }
    };
    socket.on("message", listener);
    socket.send(JSON.stringify(message));
  });
}

describe("BridgeServer", () => {
  it("pairs, recovers a snapshot, reviews changes, and consumes deploy approval once", async () => {
    const server = new BridgeServer(fixture());
    servers.push(server);
    const port = await server.listen();
    const socket = await open(`ws://127.0.0.1:${port}`);

    const unauthenticated = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "getSnapshot",
      requestId: "unauth",
    });
    expect(unauthenticated.error?.code).toBe("authentication_required");

    const paired = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "pair",
      requestId: "pair",
      pairingToken: server.pairingToken,
      clientName: "Test phone",
    });
    expect(paired.ok).toBe(true);
    expect((paired.data as { sessionToken: string }).sessionToken).toMatch(
      /^[A-Za-z0-9_-]+$/,
    );

    const snapshot = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "getSnapshot",
      requestId: "snapshot",
    });
    expect(
      (snapshot.data as { snapshot: { projects: unknown[] } }).snapshot
        .projects,
    ).toHaveLength(1);

    expect(
      (
        await request(socket, {
          version: PROTOCOL_VERSION,
          type: "startOperation",
          requestId: "start-dev",
          projectId: "site",
          operation: "dev",
        })
      ).ok,
    ).toBe(true);

    expect(
      (
        await request(socket, {
          version: PROTOCOL_VERSION,
          type: "startOperation",
          requestId: "start-agent",
          projectId: "site",
          operation: "agent",
        })
      ).ok,
    ).toBe(true);
    const attachment = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "agentAttachment",
      requestId: "attachment",
      projectId: "site",
      mimeType: "image/jpeg",
      base64: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
      note: "broken card",
    });
    expect(attachment.ok).toBe(true);
    expect(
      readdirSync(
        join(
          server.config.projects[0]!.repositoryPath,
          ".state",
          "attachments",
        ),
      ),
    ).toHaveLength(1);
    expect(
      (
        await request(socket, {
          version: PROTOCOL_VERSION,
          type: "stopOperation",
          requestId: "stop-agent",
          projectId: "site",
          operation: "agent",
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await request(socket, {
          version: PROTOCOL_VERSION,
          type: "stopOperation",
          requestId: "stop-dev",
          projectId: "site",
          operation: "dev",
        })
      ).ok,
    ).toBe(true);

    const review = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "getReview",
      requestId: "review",
      projectId: "site",
    });
    expect(
      (review.data as { review: { files: string[] } }).review.files,
    ).toContain("file.txt");

    const staged = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "stageFile",
      requestId: "stage",
      projectId: "site",
      file: "file.txt",
    });
    expect(
      (staged.data as { review: { stagedFiles: string[] } }).review.stagedFiles,
    ).toContain("file.txt");

    const commitApproval = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "requestApproval",
      requestId: "commit-approval",
      projectId: "site",
      operation: "commit",
      message: "Update fixture",
    });
    const commitApprovalId = (
      commitApproval.data as { approval: { id: string } }
    ).approval.id;
    writeFileSync(
      join(server.config.projects[0]!.repositoryPath, "file.txt"),
      "changed after approval\n",
    );
    execFileSync("git", ["add", "file.txt"], {
      cwd: server.config.projects[0]!.repositoryPath,
    });
    const staleCommit = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "resolveApproval",
      requestId: "stale-commit",
      approvalId: commitApprovalId,
      approve: true,
    });
    expect(staleCommit.error?.code).toBe("approval_stale");
    const freshCommitApproval = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "requestApproval",
      requestId: "fresh-commit-approval",
      projectId: "site",
      operation: "commit",
      message: "Update fixture",
    });
    const committed = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "resolveApproval",
      requestId: "commit",
      approvalId: (freshCommitApproval.data as { approval: { id: string } })
        .approval.id,
      approve: true,
    });
    expect(
      (committed.data as { review: { files: string[] } }).review.files,
    ).not.toContain("file.txt");

    const approvalResponse = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "requestApproval",
      requestId: "approval",
      projectId: "site",
      operation: "deploy",
    });
    const approvalId = (approvalResponse.data as { approval: { id: string } })
      .approval.id;
    const approved = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "resolveApproval",
      requestId: "approve",
      approvalId,
      approve: true,
    });
    expect(approved.ok).toBe(true);

    const replay = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "resolveApproval",
      requestId: "replay",
      approvalId,
      approve: true,
    });
    expect(replay.error?.code).toBe("approval_expired");
    socket.close();
  });

  it("rejects a reused pairing token", async () => {
    const server = new BridgeServer(fixture());
    servers.push(server);
    const port = await server.listen();
    const first = await open(`ws://127.0.0.1:${port}`);
    const second = await open(`ws://127.0.0.1:${port}`);
    const pair = (socket: WebSocket, requestId: string) =>
      request(socket, {
        version: PROTOCOL_VERSION,
        type: "pair",
        requestId,
        pairingToken: server.pairingToken,
        clientName: "Phone",
      });
    expect((await pair(first, "first")).ok).toBe(true);
    expect((await pair(second, "second")).error?.code).toBe("pairing_rejected");
    first.close();
    second.close();
  });

  it("rejects control messages on an already-open socket after session expiry", async () => {
    let now = 1_000;
    const config = fixture();
    config.sessionTtlSeconds = 60;
    const server = new BridgeServer(config, () => now);
    servers.push(server);
    const port = await server.listen();
    const socket = await open(`ws://127.0.0.1:${port}`);
    expect(
      (
        await request(socket, {
          version: PROTOCOL_VERSION,
          type: "pair",
          requestId: "pair-expiry",
          pairingToken: server.pairingToken,
          clientName: "Phone",
        })
      ).ok,
    ).toBe(true);
    now = 61_000;
    const expired = await request(socket, {
      version: PROTOCOL_VERSION,
      type: "getSnapshot",
      requestId: "expired",
    });
    expect(expired.error?.code).toBe("authentication_required");
    socket.close();
  });
});
