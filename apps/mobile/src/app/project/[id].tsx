import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  ApprovalRequest,
  OperationName,
  ReviewResult,
} from "@mobile-dev-cockpit/protocol";
import { PreviewPane } from "../../components/preview-pane";
import { Button, Card, Label, StatusDot } from "../../components/ui";
import { useConnection } from "../../lib/connection";
import { deploymentRefreshKey } from "../../lib/project-view";
import { colors } from "../../lib/theme";

type Section = "control" | "preview" | "agent" | "review" | "deploy";

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const connection = useConnection();
  const project = connection.snapshot?.projects.find(
    (candidate) => candidate.id === id,
  );
  const [section, setSection] = useState<Section>("control");
  const [instruction, setInstruction] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [previewTarget, setPreviewTarget] = useState<"preview" | "production">(
    "preview",
  );
  const [captureNote, setCaptureNote] = useState("");
  const [captureStatus, setCaptureStatus] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [localError, setLocalError] = useState<string>();
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest>();

  const logs = useMemo(
    () => connection.logs.filter((entry) => entry.projectId === id).slice(-250),
    [connection.logs, id],
  );

  if (!project) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          Project is not available on this bridge.
        </Text>
        <Button onPress={() => router.back()}>Back</Button>
      </View>
    );
  }

  const run = async (
    operation: "dev" | "tunnel" | "build" | "test" | "agent",
  ): Promise<void> => {
    setBusy(operation);
    setLocalError(undefined);
    try {
      await connection.request({
        type: "startOperation",
        projectId: project.id,
        operation,
      });
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Operation failed",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const stop = async (operation: OperationName): Promise<void> => {
    setBusy(`stop-${operation}`);
    try {
      await connection.request({
        type: "stopOperation",
        projectId: project.id,
        operation,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Stop failed");
    } finally {
      setBusy(undefined);
    }
  };

  const refreshReview = async (): Promise<void> => {
    setBusy("review");
    setLocalError(undefined);
    try {
      const data = await connection.request<{ review: ReviewResult }>({
        type: "getReview",
        projectId: project.id,
      });
      connection.setReview(data.review);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Review failed");
    } finally {
      setBusy(undefined);
    }
  };

  const sendAgentInput = async (
    value: string,
    clearComposer = false,
  ): Promise<void> => {
    if (!value) return;
    setBusy("instruction");
    try {
      await connection.request({
        type: "agentInstruction",
        projectId: project.id,
        instruction: value,
      });
      if (clearComposer) setInstruction("");
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Instruction failed",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const sendInstruction = async (): Promise<void> => {
    await sendAgentInput(instruction.trim(), true);
  };

  const resumeAgent = async (): Promise<void> => {
    setBusy("resume-agent");
    setLocalError(undefined);
    try {
      await connection.request({ type: "resumeAgent", projectId: project.id });
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Agent resume failed",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const requestApproval = async (
    operation: ApprovalRequest["operation"],
    options: { file?: string; message?: string } = {},
  ): Promise<void> => {
    setBusy(operation);
    setLocalError(undefined);
    try {
      const { approval } = await connection.request<{
        approval: ApprovalRequest;
      }>({
        type: "requestApproval",
        projectId: project.id,
        operation,
        ...options,
      });
      setPendingApproval(approval);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setBusy(undefined);
    }
  };

  const resolveApproval = async (approve: boolean): Promise<void> => {
    if (!pendingApproval) return;
    setBusy("resolve-approval");
    try {
      const data = await connection.request<{ review?: ReviewResult }>({
        type: "resolveApproval",
        approvalId: pendingApproval.id,
        approve,
      });
      if (data.review) connection.setReview(data.review);
      setPendingApproval(undefined);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setBusy(undefined);
    }
  };

  const updateFile = async (
    type: "stageFile" | "unstageFile",
    file: string,
  ): Promise<void> => {
    setBusy(`${type}:${file}`);
    setLocalError(undefined);
    try {
      const data = await connection.request<{ review: ReviewResult }>({
        type,
        projectId: project.id,
        file,
      });
      connection.setReview(data.review);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Git action failed",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const sendPreviewToAgent = async (attachment: {
    mimeType: "image/jpeg";
    base64: string;
  }): Promise<void> => {
    setCaptureStatus(undefined);
    setLocalError(undefined);
    try {
      await connection.request({
        type: "agentAttachment",
        projectId: project.id,
        mimeType: attachment.mimeType,
        base64: attachment.base64,
        note: captureNote.trim() || undefined,
      });
      setCaptureStatus("Screenshot sent to the active agent.");
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Screenshot delivery failed",
      );
      throw error;
    }
  };

  const devRunning = project.processes.dev?.phase === "running";
  const tunnelRunning = project.processes.tunnel?.phase === "running";
  const agentRunning = project.processes.agent?.phase === "running";
  const deploySucceeded = project.processes.deploy?.phase === "succeeded";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.heading}>
        <View style={styles.headingTitle}>
          <Button variant="secondary" onPress={() => router.back()}>
            Back
          </Button>
          <StatusDot active={devRunning || agentRunning} />
          <Text style={styles.title}>{project.name}</Text>
        </View>
        <Text style={styles.meta}>{connection.status}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {(["control", "preview", "agent", "review", "deploy"] as Section[]).map(
          (name) => (
            <Button
              key={name}
              variant={section === name ? "primary" : "secondary"}
              onPress={() => setSection(name)}
            >
              {name}
            </Button>
          ),
        )}
      </ScrollView>

      {localError || connection.error ? (
        <Text style={styles.error}>{localError ?? connection.error}</Text>
      ) : null}

      {section === "control" ? (
        <>
          <Card>
            <Label>Development server</Label>
            <ProcessLine
              operation="dev"
              phase={project.processes.dev?.phase ?? "idle"}
            />
            {devRunning ? (
              <Button
                variant="danger"
                busy={busy === "stop-dev"}
                onPress={() => void stop("dev")}
              >
                Stop dev server
              </Button>
            ) : (
              <Button
                disabled={!project.capabilities.dev}
                busy={busy === "dev"}
                onPress={() => void run("dev")}
              >
                Start dev server
              </Button>
            )}
            {project.previewUrl ? (
              <Button variant="secondary" onPress={() => setSection("preview")}>
                Open preview
              </Button>
            ) : null}
            {project.capabilities.tunnel ? (
              <>
                <ProcessLine
                  operation="tunnel"
                  phase={project.processes.tunnel?.phase ?? "idle"}
                />
                {tunnelRunning ? (
                  <Button
                    variant="danger"
                    busy={busy === "stop-tunnel"}
                    onPress={() => void stop("tunnel")}
                  >
                    Stop secure preview
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    busy={busy === "tunnel"}
                    onPress={() => void run("tunnel")}
                  >
                    Start secure preview
                  </Button>
                )}
              </>
            ) : null}
          </Card>
          <Card>
            <Label>Checks</Label>
            <ProcessLine
              operation="build"
              phase={project.processes.build?.phase ?? "idle"}
            />
            <Button
              disabled={!project.capabilities.build}
              busy={busy === "build"}
              onPress={() => void run("build")}
            >
              Run configured build
            </Button>
            <ProcessLine
              operation="test"
              phase={project.processes.test?.phase ?? "idle"}
            />
            <Button
              disabled={!project.capabilities.test}
              busy={busy === "test"}
              onPress={() => void run("test")}
            >
              Run configured tests
            </Button>
          </Card>
          <LogPanel logs={logs} />
        </>
      ) : null}

      {section === "preview" ? (
        project.previewUrl || project.productionUrl ? (
          <>
            <View style={styles.previewTargets}>
              {project.previewUrl ? (
                <Button
                  variant={
                    previewTarget === "preview" ? "primary" : "secondary"
                  }
                  onPress={() => setPreviewTarget("preview")}
                >
                  Development
                </Button>
              ) : null}
              {project.productionUrl ? (
                <Button
                  variant={
                    previewTarget === "production" ? "primary" : "secondary"
                  }
                  onPress={() => setPreviewTarget("production")}
                >
                  Production
                </Button>
              ) : null}
            </View>
            <TextInput
              value={captureNote}
              onChangeText={setCaptureNote}
              maxLength={2_000}
              placeholder="Optional context for the agent screenshot"
              placeholderTextColor={colors.muted}
              style={styles.commitInput}
            />
            {captureStatus ? (
              <Text style={styles.success}>{captureStatus}</Text>
            ) : null}
            <PreviewPane
              key={`${previewTarget}:${deploymentRefreshKey(project.processes.deploy)}`}
              url={
                previewTarget === "production" && project.productionUrl
                  ? project.productionUrl
                  : (project.previewUrl ?? project.productionUrl!)
              }
              canSendToAgent={agentRunning}
              onSendToAgent={sendPreviewToAgent}
            />
          </>
        ) : (
          <Empty message="No preview or production URL is configured for this project." />
        )
      ) : null}

      {section === "agent" ? (
        <>
          <Card>
            <Label>Agent session</Label>
            <ProcessLine
              operation="agent"
              phase={project.processes.agent?.phase ?? "idle"}
            />
            {agentRunning ? (
              <Button
                variant="danger"
                busy={busy === "stop-agent"}
                onPress={() => void stop("agent")}
              >
                Stop agent
              </Button>
            ) : (
              <>
                <Button
                  disabled={!project.capabilities.agent}
                  busy={busy === "agent"}
                  onPress={() => void run("agent")}
                >
                  Start configured agent
                </Button>
                {project.capabilities.agentResume ? (
                  <Button
                    variant="secondary"
                    busy={busy === "resume-agent"}
                    onPress={() => void resumeAgent()}
                  >
                    Resume previous session
                  </Button>
                ) : null}
              </>
            )}
            <TextInput
              value={instruction}
              onChangeText={setInstruction}
              multiline
              placeholder="Describe the mobile issue or next change…"
              placeholderTextColor={colors.muted}
              style={styles.instruction}
            />
            <Button
              disabled={!agentRunning || !instruction.trim()}
              busy={busy === "instruction"}
              onPress={() => void sendInstruction()}
            >
              Send instruction
            </Button>
            <Text style={styles.warning}>
              Use prompt decisions only while the visible agent output is asking
              for confirmation.
            </Text>
            <View style={styles.approvalActions}>
              <View style={styles.flexAction}>
                <Button
                  variant="secondary"
                  disabled={!agentRunning}
                  busy={busy === "instruction"}
                  onPress={() => void sendAgentInput("n")}
                >
                  Deny prompt
                </Button>
              </View>
              <View style={styles.flexAction}>
                <Button
                  variant="danger"
                  disabled={!agentRunning}
                  busy={busy === "instruction"}
                  onPress={() => void sendAgentInput("y")}
                >
                  Approve prompt
                </Button>
              </View>
            </View>
          </Card>
          <LogPanel
            logs={logs.filter((entry) => entry.operation === "agent")}
          />
        </>
      ) : null}

      {section === "review" ? (
        <>
          <Card>
            <View style={styles.row}>
              <Label>Git changes</Label>
              <Button
                variant="secondary"
                busy={busy === "review"}
                onPress={() => void refreshReview()}
              >
                Refresh
              </Button>
            </View>
            {connection.review?.projectId === project.id ? (
              <>
                <Text style={styles.meta}>
                  {connection.review.files.length} changed files
                  {connection.review.truncated ? " · diff truncated" : ""}
                </Text>
                {connection.review.files.map((file) => {
                  const staged =
                    connection.review?.stagedFiles.includes(file) ?? false;
                  const untracked =
                    connection.review?.untrackedFiles.includes(file) ?? false;
                  return (
                    <View key={file} style={styles.fileRow}>
                      <Text style={styles.file} numberOfLines={2}>
                        {staged ? "●" : "○"} {file}
                      </Text>
                      <View style={styles.fileActions}>
                        <Button
                          variant="secondary"
                          busy={
                            busy ===
                            `${staged ? "unstageFile" : "stageFile"}:${file}`
                          }
                          onPress={() =>
                            void updateFile(
                              staged ? "unstageFile" : "stageFile",
                              file,
                            )
                          }
                        >
                          {staged ? "Unstage" : "Stage"}
                        </Button>
                        {!untracked ? (
                          <Button
                            variant="danger"
                            onPress={() =>
                              void requestApproval("revert", { file })
                            }
                          >
                            Revert
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                <ScrollView horizontal style={styles.codeFrame}>
                  <Text selectable style={styles.code}>
                    {connection.review.diff ||
                      "No tracked diff. Untracked files are listed above."}
                  </Text>
                </ScrollView>
              </>
            ) : (
              <Text style={styles.meta}>
                Refresh to inspect the current repository status and bounded
                diff.
              </Text>
            )}
          </Card>
          <Button
            disabled={!project.capabilities.test}
            onPress={() => void run("test")}
          >
            Run tests before deploy
          </Button>
          <Card>
            <Label>Commit staged changes</Label>
            <Text style={styles.meta}>
              {connection.review?.stagedFiles.length ?? 0} staged files
            </Text>
            <TextInput
              value={commitMessage}
              onChangeText={setCommitMessage}
              maxLength={200}
              placeholder="Commit message"
              placeholderTextColor={colors.muted}
              style={styles.commitInput}
            />
            <Button
              disabled={
                !commitMessage.trim() || !connection.review?.stagedFiles.length
              }
              onPress={() =>
                void requestApproval("commit", {
                  message: commitMessage.trim(),
                })
              }
            >
              Review commit approval
            </Button>
          </Card>
        </>
      ) : null}

      {section === "deploy" ? (
        <>
          <Card>
            <Label>Production gate</Label>
            <Text style={styles.warning}>
              The bridge will show the exact configured command and require a
              fresh one-use approval. No deployment starts from opening this
              screen.
            </Text>
            <ProcessLine
              operation="deploy"
              phase={project.processes.deploy?.phase ?? "idle"}
            />
            <Button
              disabled={!project.capabilities.deploy}
              busy={busy === "deploy"}
              onPress={() => void requestApproval("deploy")}
            >
              Review deployment approval
            </Button>
            {project.capabilities.rollback ? (
              <Button
                variant="danger"
                busy={busy === "rollback"}
                onPress={() => void requestApproval("rollback")}
              >
                Review rollback approval
              </Button>
            ) : null}
            {project.productionUrl ? (
              <>
                {deploySucceeded ? (
                  <Text style={styles.success}>
                    Deployment succeeded. The production preview is ready to
                    refresh.
                  </Text>
                ) : null}
                <Button
                  variant={deploySucceeded ? "primary" : "secondary"}
                  onPress={() => {
                    setPreviewTarget("production");
                    setSection("preview");
                  }}
                >
                  {deploySucceeded
                    ? "Open refreshed production preview"
                    : "Open production preview"}
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => void Linking.openURL(project.productionUrl!)}
                >
                  Open production in Safari
                </Button>
              </>
            ) : null}
          </Card>
          <LogPanel
            logs={logs.filter(
              (entry) =>
                entry.operation === "deploy" || entry.operation === "rollback",
            )}
          />
        </>
      ) : null}

      {pendingApproval ? (
        <Card>
          <Label>{pendingApproval.operation} approval</Label>
          <Text style={styles.approvalTitle}>
            {pendingApproval.projectName}
          </Text>
          {pendingApproval.target ? (
            <Text style={styles.meta}>{pendingApproval.target}</Text>
          ) : null}
          <Text selectable style={styles.approvalCommand}>
            {pendingApproval.commandLabel}
          </Text>
          <Text style={styles.warning}>
            One use · expires{" "}
            {new Date(pendingApproval.expiresAt).toLocaleTimeString()}
          </Text>
          <View style={styles.approvalActions}>
            <View style={styles.flexAction}>
              <Button
                variant="secondary"
                busy={busy === "resolve-approval"}
                onPress={() => void resolveApproval(false)}
              >
                Cancel
              </Button>
            </View>
            <View style={styles.flexAction}>
              <Button
                variant="danger"
                busy={busy === "resolve-approval"}
                onPress={() => void resolveApproval(true)}
              >
                Approve {pendingApproval.operation}
              </Button>
            </View>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function ProcessLine({
  operation,
  phase,
}: {
  operation: OperationName;
  phase: string;
}) {
  const active = phase === "running";
  return (
    <View style={styles.row}>
      <View style={styles.headingTitle}>
        <StatusDot active={active} />
        <Text style={styles.body}>{operation}</Text>
      </View>
      <Text style={[styles.phase, active && styles.phaseActive]}>{phase}</Text>
    </View>
  );
}

function LogPanel({
  logs,
}: {
  logs: ReturnType<typeof useConnection>["logs"];
}) {
  return (
    <Card>
      <View style={styles.row}>
        <Label>Live output</Label>
        <Text style={styles.meta}>{logs.length} lines</Text>
      </View>
      <ScrollView style={styles.logFrame} nestedScrollEnabled>
        {logs.length ? (
          logs.map((entry, index) => (
            <Text
              key={`${entry.timestamp}-${index}`}
              selectable
              style={[styles.log, entry.stream === "stderr" && styles.stderr]}
            >
              <Text style={styles.logPrefix}>
                {entry.operation.slice(0, 4)}{" "}
              </Text>
              {entry.line}
            </Text>
          ))
        ) : (
          <Text style={styles.meta}>Output will appear here.</Text>
        )}
      </ScrollView>
    </Card>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <Card>
      <Text style={styles.meta}>{message}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 16,
    paddingBottom: 64,
    gap: 14,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    backgroundColor: colors.canvas,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 16,
    backgroundColor: colors.canvas,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
  },
  headingTitle: { flexDirection: "row", alignItems: "center", gap: 9 },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  tabs: { gap: 8, paddingBottom: 2 },
  previewTargets: { flexDirection: "row", gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  phase: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  phaseActive: { color: colors.accent },
  instruction: {
    minHeight: 120,
    backgroundColor: colors.code,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: "top",
  },
  logFrame: {
    maxHeight: 330,
    backgroundColor: colors.code,
    borderRadius: 12,
    padding: 12,
  },
  log: {
    color: "#C7D5E5",
    fontFamily: "Courier",
    fontSize: 11,
    lineHeight: 17,
  },
  logPrefix: { color: colors.accent, fontWeight: "700" },
  stderr: { color: "#FFABB2" },
  file: { color: colors.text, fontFamily: "Courier", fontSize: 12 },
  fileRow: {
    gap: 8,
    paddingVertical: 8,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileActions: { flexDirection: "row", gap: 8 },
  commitInput: {
    minHeight: 48,
    backgroundColor: colors.code,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
  },
  codeFrame: {
    maxHeight: 520,
    backgroundColor: colors.code,
    borderRadius: 12,
    padding: 12,
  },
  code: {
    color: "#C7D5E5",
    fontFamily: "Courier",
    fontSize: 11,
    lineHeight: 17,
  },
  warning: { color: colors.warning, fontSize: 13, lineHeight: 19 },
  success: { color: colors.success, fontSize: 13, lineHeight: 19 },
  approvalTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  approvalCommand: {
    color: colors.accent,
    backgroundColor: colors.code,
    borderRadius: 10,
    padding: 12,
    fontFamily: "Courier",
    fontSize: 12,
  },
  approvalActions: { flexDirection: "row", gap: 10 },
  flexAction: { flex: 1 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
