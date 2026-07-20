import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import {
  PROTOCOL_VERSION,
  ProtocolError,
  parseClientRequest,
  type ApprovalRequest,
  type ApprovalOperation,
  type ClientRequest,
  type CommandCandidate,
  type EnrollmentProposal,
  type MachineSnapshot,
  type OperationName,
  type ServerMessage,
  type ServerResponse,
} from "@mobile-dev-cockpit/protocol";
import { WebSocket, WebSocketServer } from "ws";
import { PairingToken, SessionStore } from "./auth.js";
import { writeAgentAttachment } from "./attachments.js";
import type { BridgeConfig, ProjectConfig } from "./config.js";
import {
  discoverRepositoryDetails,
  type RepositoryDetails,
} from "./discover.js";
import { ProcessManager } from "./process-manager.js";
import { ProjectRegistry } from "./project-registry.js";
import {
  commandsFromCandidates,
  detectCommandCandidates,
  metadataFingerprint,
  type InternalCandidate,
} from "./repository-candidates.js";
import {
  commitStaged,
  getReview,
  revertFile,
  stageFile,
  stagedFingerprint,
  unstageFile,
  worktreeFingerprint,
} from "./review.js";

interface PendingApproval {
  approval: ApprovalRequest;
  expiresAt: number;
  file?: string;
  message?: string;
  fingerprint?: string;
}

interface PendingEnrollment {
  proposal: EnrollmentProposal;
  repositoryId?: string;
  projectId?: string;
  candidateIds: string[];
  fingerprint?: string;
  expiresAt: number;
}

export class BridgeServer {
  private readonly sockets = new Set<WebSocket>();
  private readonly authenticated = new WeakSet<WebSocket>();
  private readonly authenticatedUntil = new WeakMap<WebSocket, number>();
  private readonly alive = new WeakMap<WebSocket, boolean>();
  private readonly sessions: SessionStore;
  private readonly pairing: PairingToken;
  private readonly processes: ProcessManager;
  private readonly registry: ProjectRegistry;
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly enrollmentApprovals = new Map<string, PendingEnrollment>();
  private readonly detectedPreviewUrls = new Map<string, string>();
  private server?: WebSocketServer;
  private heartbeat?: NodeJS.Timeout;

  constructor(
    readonly config: BridgeConfig,
    private readonly now: () => number = Date.now,
  ) {
    this.sessions = new SessionStore(
      config.stateFile,
      config.sessionTtlSeconds,
    );
    this.pairing = new PairingToken(config.pairingTtlSeconds, this.now());
    this.processes = new ProcessManager(config.logLineLimit);
    this.registry = new ProjectRegistry(config);
    this.processes.on("log", (entry) =>
      this.broadcast({ version: PROTOCOL_VERSION, type: "log", entry }),
    );
    this.processes.on("process", ({ projectId, process }) =>
      this.broadcast({
        version: PROTOCOL_VERSION,
        type: "process",
        projectId,
        process,
      }),
    );
    this.processes.on("preview", ({ projectId, url }) => {
      this.detectedPreviewUrls.set(projectId, this.reachablePreviewUrl(url));
      this.broadcast({
        version: PROTOCOL_VERSION,
        type: "snapshot",
        snapshot: this.snapshot(),
      });
    });
  }

  get pairingToken(): string {
    return this.pairing.value;
  }

  get pairingExpiresAt(): Date {
    return new Date(this.pairing.expiresAt);
  }

  async listen(): Promise<number> {
    if (this.server) throw new Error("Bridge is already listening");
    this.server = new WebSocketServer({
      host: this.config.host,
      port: this.config.port,
      maxPayload: 6 * 1024 * 1024,
    });
    this.server.on("connection", (socket) => this.onConnection(socket));
    await new Promise<void>((resolve, reject) => {
      this.server?.once("listening", resolve);
      this.server?.once("error", reject);
    });
    this.heartbeat = setInterval(() => {
      for (const socket of this.sockets) {
        if (this.alive.get(socket) === false) {
          socket.terminate();
          continue;
        }
        this.alive.set(socket, false);
        socket.ping();
      }
    }, 15_000);
    this.heartbeat.unref();
    return (this.server.address() as AddressInfo).port;
  }

  async close(): Promise<void> {
    this.processes.close();
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    for (const socket of this.sockets) socket.close();
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
    this.server = undefined;
  }

  snapshot(): MachineSnapshot {
    return {
      machineName: this.config.machineName,
      bridgeVersion: "0.1.0",
      protocolVersion: PROTOCOL_VERSION,
      projects: this.registry.all().map((project) => ({
        id: project.id,
        name: project.name,
        previewUrl:
          this.detectedPreviewUrls.get(project.id) ?? project.previewUrl,
        productionUrl: project.productionUrl,
        capabilities: {
          dev: Boolean(project.commands.dev),
          tunnel: Boolean(project.commands.tunnel),
          build: Boolean(project.commands.build),
          test: Boolean(project.commands.test),
          agent: Boolean(project.commands.agent),
          agentResume: Boolean(project.commands.agentResume),
          deploy: Boolean(project.commands.deploy),
          rollback: Boolean(project.commands.rollback),
        },
        processes: this.processes.snapshots(project.id),
        source: project.source ?? "static",
      })),
    };
  }

  private onConnection(socket: WebSocket): void {
    this.sockets.add(socket);
    this.alive.set(socket, true);
    socket.on("pong", () => this.alive.set(socket, true));
    socket.on("close", () => this.sockets.delete(socket));
    socket.on(
      "message",
      (data) => void this.onMessage(socket, data.toString()),
    );
  }

  private async onMessage(socket: WebSocket, raw: string): Promise<void> {
    let requestId = "unknown";
    try {
      const request = parseClientRequest(raw);
      requestId = request.requestId;
      if (request.type === "pair") {
        if (!this.pairing.consume(request.pairingToken, this.now()))
          throw new ProtocolError(
            "pairing_rejected",
            "Pairing token is invalid, expired, or already used",
          );
        const session = this.sessions.create(this.now());
        this.authenticated.add(socket);
        this.authenticatedUntil.set(socket, session.expiresAt);
        this.sendResponse(socket, requestId, {
          sessionToken: session.token,
          sessionExpiresAt: new Date(session.expiresAt).toISOString(),
          snapshot: this.snapshot(),
        });
        return;
      }
      if (request.type === "authenticate") {
        const expiresAt = this.sessions.expiresAt(
          request.sessionToken,
          this.now(),
        );
        if (!expiresAt)
          throw new ProtocolError(
            "authentication_failed",
            "Session credential is invalid or expired",
          );
        this.authenticated.add(socket);
        this.authenticatedUntil.set(socket, expiresAt);
        this.sendResponse(socket, requestId, { snapshot: this.snapshot() });
        return;
      }
      if (!this.isAuthenticated(socket)) {
        throw new ProtocolError(
          "authentication_required",
          "Authenticate with a valid unexpired session before sending control messages",
        );
      }
      const data = await this.handleAuthenticated(request);
      this.sendResponse(socket, requestId, data);
    } catch (error) {
      const code =
        error instanceof ProtocolError ? error.code : "operation_failed";
      const message =
        error instanceof Error ? error.message : "Unknown bridge error";
      this.sendResponse(socket, requestId, undefined, { code, message });
      if (
        code === "authentication_failed" ||
        (code === "authentication_required" && this.authenticated.has(socket))
      ) {
        socket.close(4001, "Authentication required");
      }
    }
  }

  private async handleAuthenticated(
    request: Exclude<ClientRequest, { type: "pair" | "authenticate" }>,
  ): Promise<unknown> {
    switch (request.type) {
      case "getSnapshot":
        return { snapshot: this.snapshot() };
      case "discoverRepositories":
        return {
          repositories: this.repositories().map((repository) =>
            this.publicRepository(repository),
          ),
        };
      case "getEnrollmentOptions": {
        const repository = this.repository(request.repositoryId);
        return {
          repository: this.publicRepository(repository),
          candidates: detectCommandCandidates(repository).map((candidate) =>
            this.publicCandidate(candidate),
          ),
        };
      }
      case "requestEnrollment":
        return {
          proposal: this.createEnrollmentProposal(
            request.repositoryId,
            request.candidateIds,
          ),
        };
      case "requestProjectRemoval":
        return {
          proposal: this.createRemovalProposal(request.projectId),
        };
      case "resolveEnrollment":
        return this.resolveEnrollment(request.proposalId, request.approve);
      case "startOperation":
        return {
          process: this.processes.start(
            this.project(request.projectId),
            request.operation,
          ),
        };
      case "stopOperation":
        return {
          process: this.processes.stop(request.projectId, request.operation),
        };
      case "agentInstruction":
        this.project(request.projectId);
        this.processes.instruct(request.projectId, request.instruction);
        return { accepted: true };
      case "resumeAgent":
        return {
          process: this.processes.startAgent(
            this.project(request.projectId),
            true,
          ),
        };
      case "agentAttachment": {
        this.project(request.projectId);
        if (!this.processes.hasActiveAgent(request.projectId))
          throw new Error("Agent is not running");
        const path = writeAgentAttachment(
          this.config.stateFile,
          request.mimeType,
          request.base64,
        );
        const note = request.note?.trim();
        this.processes.instruct(
          request.projectId,
          `Review the mobile preview screenshot at ${path}.${note ? ` Context: ${note}` : ""}`,
        );
        return { accepted: true };
      }
      case "getReview":
        return {
          review: getReview(
            this.project(request.projectId),
            this.config.diffByteLimit,
          ),
        };
      case "stageFile":
        return {
          review: stageFile(
            this.project(request.projectId),
            request.file,
            this.config.diffByteLimit,
          ),
        };
      case "unstageFile":
        return {
          review: unstageFile(
            this.project(request.projectId),
            request.file,
            this.config.diffByteLimit,
          ),
        };
      case "requestApproval":
        return {
          approval: this.createApproval(
            this.project(request.projectId),
            request.operation,
            request.file,
            request.message,
          ),
        };
      case "resolveApproval":
        return this.resolveApproval(request.approvalId, request.approve);
    }
  }

  private project(projectId: string): ProjectConfig {
    const project = this.registry.get(projectId);
    if (!project)
      throw new ProtocolError("unknown_project", "Project is not configured");
    return project;
  }

  private repositories(): RepositoryDetails[] {
    return discoverRepositoryDetails(
      this.config.discoveryRoots,
      this.registry.enrolledPaths(),
    );
  }

  private repository(repositoryId: string): RepositoryDetails {
    const repository = this.repositories().find(
      (candidate) => candidate.id === repositoryId,
    );
    if (!repository)
      throw new ProtocolError(
        "unknown_repository",
        "Repository is no longer available inside an approved discovery root",
      );
    return repository;
  }

  private publicRepository({
    repositoryPath: _path,
    discoveryRoot: _root,
    ...repository
  }: RepositoryDetails) {
    return repository;
  }

  private publicCandidate({
    argv: _argv,
    ...candidate
  }: InternalCandidate): CommandCandidate {
    return candidate;
  }

  private createEnrollmentProposal(
    repositoryId: string,
    candidateIds: string[],
  ): EnrollmentProposal {
    const repository = this.repository(repositoryId);
    const allCandidates = detectCommandCandidates(repository);
    const selected = candidateIds.map((candidateId) => {
      const candidate = allCandidates.find((item) => item.id === candidateId);
      if (!candidate)
        throw new ProtocolError(
          "stale_candidate",
          "A selected command candidate is missing or changed",
        );
      return candidate;
    });
    try {
      commandsFromCandidates(selected);
    } catch (error) {
      throw new ProtocolError(
        "invalid_candidates",
        error instanceof Error ? error.message : "Invalid command selection",
      );
    }
    const existingProject = repository.enrolledProjectId
      ? this.registry.get(repository.enrolledProjectId, false)
      : undefined;
    if (existingProject?.source === "static")
      throw new ProtocolError(
        "static_project",
        "Static projects can only be changed in local configuration",
      );
    const id = randomUUID();
    const expiresAt = this.now() + this.config.approvalTtlSeconds * 1000;
    const proposal: EnrollmentProposal = {
      id,
      action: existingProject ? "update" : "enroll",
      repository: this.publicRepository(repository),
      projectId: existingProject?.id,
      projectName: existingProject?.name ?? repository.name,
      candidates: selected.map((candidate) => this.publicCandidate(candidate)),
      selectedCandidateIds: selected.map((candidate) => candidate.id),
      expiresAt: new Date(expiresAt).toISOString(),
    };
    this.enrollmentApprovals.set(id, {
      proposal,
      repositoryId,
      projectId: existingProject?.id,
      candidateIds: proposal.selectedCandidateIds,
      fingerprint: metadataFingerprint(repository.repositoryPath),
      expiresAt,
    });
    return proposal;
  }

  private createRemovalProposal(projectId: string): EnrollmentProposal {
    const project = this.registry.get(projectId, false);
    if (!project)
      throw new ProtocolError("unknown_project", "Project is not configured");
    if (project.source !== "dynamic")
      throw new ProtocolError(
        "static_project",
        "Static projects can only be changed in local configuration",
      );
    if (this.processes.hasActiveProject(projectId))
      throw new ProtocolError(
        "project_busy",
        "Stop every project process before removing it",
      );
    const id = randomUUID();
    const expiresAt = this.now() + this.config.approvalTtlSeconds * 1000;
    const proposal: EnrollmentProposal = {
      id,
      action: "remove",
      projectId,
      projectName: project.name,
      candidates: [],
      selectedCandidateIds: [],
      expiresAt: new Date(expiresAt).toISOString(),
    };
    this.enrollmentApprovals.set(id, {
      proposal,
      projectId,
      candidateIds: [],
      expiresAt,
    });
    return proposal;
  }

  private resolveEnrollment(proposalId: string, approve: boolean): unknown {
    const pending = this.enrollmentApprovals.get(proposalId);
    this.enrollmentApprovals.delete(proposalId);
    if (!pending || this.now() >= pending.expiresAt)
      throw new ProtocolError(
        "approval_expired",
        "Enrollment approval is missing, expired, or already consumed",
      );
    if (!approve) return { approved: false };
    if (pending.proposal.action === "remove") {
      if (!pending.projectId)
        throw new ProtocolError(
          "unknown_project",
          "Removal has no project target",
        );
      if (this.processes.hasActiveProject(pending.projectId))
        throw new ProtocolError(
          "project_busy",
          "Project became active after approval",
        );
      this.registry.remove(pending.projectId);
      this.broadcast({
        version: PROTOCOL_VERSION,
        type: "snapshot",
        snapshot: this.snapshot(),
      });
      return {
        approved: true,
        removedProjectId: pending.projectId,
        snapshot: this.snapshot(),
      };
    }
    if (!pending.repositoryId)
      throw new ProtocolError(
        "unknown_repository",
        "Enrollment has no repository target",
      );
    const repository = this.repository(pending.repositoryId);
    if (metadataFingerprint(repository.repositoryPath) !== pending.fingerprint)
      throw new ProtocolError(
        "approval_stale",
        "Repository command metadata changed after review",
      );
    const allCandidates = detectCommandCandidates(repository);
    const selected = pending.candidateIds.map((candidateId) => {
      const candidate = allCandidates.find((item) => item.id === candidateId);
      if (!candidate)
        throw new ProtocolError(
          "approval_stale",
          "A selected command candidate changed after review",
        );
      return candidate;
    });
    const project = this.registry.enroll(repository, selected);
    const snapshot = this.snapshot();
    this.broadcast({ version: PROTOCOL_VERSION, type: "snapshot", snapshot });
    return { approved: true, projectId: project.id, snapshot };
  }

  private reachablePreviewUrl(value: string): string {
    const url = new URL(value);
    if (
      this.config.advertisedHost &&
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    ) {
      url.hostname = this.config.advertisedHost;
    }
    return url.toString();
  }

  private createApproval(
    project: ProjectConfig,
    operation: ApprovalOperation,
    file?: string,
    message?: string,
  ): ApprovalRequest {
    let commandLabel: string;
    let target: string | undefined;
    let fingerprint: string | undefined;
    if (operation === "deploy" || operation === "rollback") {
      const command = project.commands[operation];
      if (!command)
        throw new ProtocolError(
          "operation_unavailable",
          `${operation} is not configured`,
        );
      commandLabel = command.join(" ");
    } else if (operation === "revert") {
      const review = getReview(project, this.config.diffByteLimit);
      if (!file || !review.files.includes(file))
        throw new ProtocolError(
          "invalid_file",
          "File is not in the current Git change set",
        );
      if (review.untrackedFiles.includes(file))
        throw new ProtocolError(
          "invalid_file",
          "Untracked files cannot be deleted from Mobile Dev Cockpit",
        );
      commandLabel = `git restore --worktree -- ${file}`;
      target = file;
      fingerprint = worktreeFingerprint(
        project,
        file,
        this.config.diffByteLimit,
      );
    } else {
      const review = getReview(project, this.config.diffByteLimit);
      if (!review.stagedFiles.length)
        throw new ProtocolError(
          "nothing_staged",
          "No staged changes to commit",
        );
      if (!message)
        throw new ProtocolError(
          "invalid_message",
          "Commit message is required",
        );
      commandLabel = `git commit -m ${JSON.stringify(message)}`;
      target = `${review.stagedFiles.length} staged file${review.stagedFiles.length === 1 ? "" : "s"}`;
      fingerprint = stagedFingerprint(project, this.config.diffByteLimit);
    }
    const id = randomUUID();
    const expiresAt = this.now() + this.config.approvalTtlSeconds * 1000;
    const approval: ApprovalRequest = {
      id,
      projectId: project.id,
      projectName: project.name,
      operation,
      commandLabel,
      target,
      expiresAt: new Date(expiresAt).toISOString(),
    };
    this.approvals.set(id, { approval, expiresAt, file, message, fingerprint });
    this.broadcast({ version: PROTOCOL_VERSION, type: "approval", approval });
    return approval;
  }

  private resolveApproval(approvalId: string, approve: boolean): unknown {
    const pending = this.approvals.get(approvalId);
    this.approvals.delete(approvalId);
    if (!pending || this.now() >= pending.expiresAt)
      throw new ProtocolError(
        "approval_expired",
        "Approval is missing, expired, or already consumed",
      );
    if (!approve) return { approved: false };
    const project = this.project(pending.approval.projectId);
    if (
      pending.approval.operation === "deploy" ||
      pending.approval.operation === "rollback"
    ) {
      const process = this.processes.start(
        project,
        pending.approval.operation as OperationName,
      );
      return { approved: true, process };
    }
    if (pending.approval.operation === "revert") {
      if (!pending.file)
        throw new ProtocolError("invalid_file", "Approval has no file target");
      if (
        pending.fingerprint !==
        worktreeFingerprint(project, pending.file, this.config.diffByteLimit)
      ) {
        throw new ProtocolError(
          "approval_stale",
          "The file changed after approval was requested",
        );
      }
      return {
        approved: true,
        review: revertFile(project, pending.file, this.config.diffByteLimit),
      };
    }
    if (!pending.message)
      throw new ProtocolError(
        "invalid_message",
        "Approval has no commit message",
      );
    if (
      pending.fingerprint !==
      stagedFingerprint(project, this.config.diffByteLimit)
    ) {
      throw new ProtocolError(
        "approval_stale",
        "Staged changes changed after approval was requested",
      );
    }
    return {
      approved: true,
      review: commitStaged(project, pending.message, this.config.diffByteLimit),
    };
  }

  private sendResponse(
    socket: WebSocket,
    requestId: string,
    data?: unknown,
    error?: ServerResponse["error"],
  ): void {
    const response: ServerResponse = {
      version: PROTOCOL_VERSION,
      type: "response",
      requestId,
      ok: !error,
      ...(data === undefined ? {} : { data }),
      ...(error ? { error } : {}),
    };
    this.send(socket, response);
  }

  private broadcast(message: ServerMessage): void {
    for (const socket of this.sockets) {
      if (this.isAuthenticated(socket)) this.send(socket, message);
    }
  }

  private isAuthenticated(socket: WebSocket): boolean {
    return (
      this.authenticated.has(socket) &&
      (this.authenticatedUntil.get(socket) ?? 0) > this.now()
    );
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  }
}
