import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type {
  CommandCandidate,
  EnrollmentProposal,
  RepositorySummary,
} from "@mobile-dev-cockpit/protocol";
import { Badge, Button, Card, Label } from "../components/ui";
import { useConnection } from "../lib/connection";
import {
  defaultCandidateSelection,
  toggleCandidateSelection,
} from "../lib/enrollment-selection";
import { deriveCockpitLayout } from "../lib/layout";
import { colors } from "../lib/theme";

interface DiscoveryResponse {
  repositories: RepositorySummary[];
}

interface OptionsResponse {
  repository: RepositorySummary;
  candidates: CommandCandidate[];
}

export default function EnrollProjectScreen() {
  const connection = useConnection();
  const window = useWindowDimensions();
  const layout = deriveCockpitLayout(window.width, window.height);
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [query, setQuery] = useState("");
  const [selectedRepository, setSelectedRepository] =
    useState<RepositorySummary>();
  const [candidates, setCandidates] = useState<CommandCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [proposal, setProposal] = useState<EnrollmentProposal>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async (): Promise<void> => {
    setBusy("discover");
    setError(undefined);
    try {
      const data = await connection.request<DiscoveryResponse>({
        type: "discoverRepositories",
      });
      setRepositories(data.repositories);
      if (
        selectedRepository &&
        !data.repositories.some(
          (repository) => repository.id === selectedRepository.id,
        )
      ) {
        setSelectedRepository(undefined);
        setCandidates([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Discovery failed");
    } finally {
      setBusy(undefined);
    }
  }, [connection, selectedRepository]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (connection.status === "connected") void load();
    }, 0);
    // Reload after bridge reconnect; selection state remains local when the same bridge returns.
    return () => clearTimeout(timer);
  }, [connection.status, load]);

  const openRepository = async (
    repository: RepositorySummary,
  ): Promise<void> => {
    setSelectedRepository(repository);
    setProposal(undefined);
    setCandidates([]);
    setSelectedIds([]);
    setBusy(`options:${repository.id}`);
    setError(undefined);
    try {
      const data = await connection.request<OptionsResponse>({
        type: "getEnrollmentOptions",
        repositoryId: repository.id,
      });
      setSelectedRepository(data.repository);
      setCandidates(data.candidates);
      setSelectedIds(defaultCandidateSelection(data.candidates));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Command detection failed",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const toggleCandidate = (candidate: CommandCandidate): void => {
    setSelectedIds((current) =>
      toggleCandidateSelection(current, candidate, candidates),
    );
    setProposal(undefined);
  };

  const requestEnrollment = async (): Promise<void> => {
    if (!selectedRepository || selectedIds.length === 0) return;
    setBusy("proposal");
    setError(undefined);
    try {
      const data = await connection.request<{ proposal: EnrollmentProposal }>({
        type: "requestEnrollment",
        repositoryId: selectedRepository.id,
        candidateIds: selectedIds,
      });
      setProposal(data.proposal);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Proposal failed");
    } finally {
      setBusy(undefined);
    }
  };

  const requestRemoval = async (): Promise<void> => {
    if (!selectedRepository?.enrolledProjectId) return;
    setBusy("remove-proposal");
    setError(undefined);
    try {
      const data = await connection.request<{ proposal: EnrollmentProposal }>({
        type: "requestProjectRemoval",
        projectId: selectedRepository.enrolledProjectId,
      });
      setProposal(data.proposal);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Removal proposal failed",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const resolveProposal = async (approve: boolean): Promise<void> => {
    if (!proposal) return;
    setBusy("resolve");
    setError(undefined);
    try {
      const data = await connection.request<{ projectId?: string }>({
        type: "resolveEnrollment",
        proposalId: proposal.id,
        approve,
      });
      setProposal(undefined);
      if (approve && data.projectId) {
        router.replace({
          pathname: "/project/[id]",
          params: { id: data.projectId },
        });
      } else if (approve) {
        setSelectedRepository(undefined);
        setCandidates([]);
        await load();
      }
    } catch (caught) {
      setProposal(undefined);
      setError(
        caught instanceof Error
          ? caught.message
          : "The proposal changed; review a fresh version",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? repositories.filter((repository) =>
          `${repository.name} ${repository.relativeLocation}`
            .toLowerCase()
            .includes(needle),
        )
      : repositories;
  }, [query, repositories]);

  const list = (
    <View
      style={[
        styles.listPane,
        layout.mode === "regular" && styles.listPaneRegular,
      ]}
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search discovered repositories"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Search discovered repositories"
        style={styles.search}
      />
      <Button
        variant="secondary"
        busy={busy === "discover"}
        onPress={() => void load()}
      >
        Refresh discovery
      </Button>
      {filtered.map((repository) => (
        <Pressable
          key={repository.id}
          accessibilityRole="button"
          accessibilityState={{
            selected: repository.id === selectedRepository?.id,
          }}
          onPress={() => void openRepository(repository)}
          style={({ pressed }) => [
            styles.repository,
            repository.id === selectedRepository?.id &&
              styles.repositorySelected,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.row}>
            <Text style={styles.repositoryName}>{repository.name}</Text>
            <Badge
              tone={repository.enrollment === "enrolled" ? "success" : "muted"}
            >
              {repository.enrollment}
            </Badge>
          </View>
          <Text style={styles.meta}>{repository.relativeLocation}</Text>
          <Text style={styles.meta}>
            {repository.ecosystem}
            {repository.packageManager ? ` · ${repository.packageManager}` : ""}
          </Text>
        </Pressable>
      ))}
      {!filtered.length && busy !== "discover" ? (
        <Text style={styles.meta}>
          No repositories found. Confirm the bridge was started with a local
          --root.
        </Text>
      ) : null}
    </View>
  );

  const detail = (
    <View style={styles.detailPane}>
      {selectedRepository ? (
        <>
          <Card elevated>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.title}>{selectedRepository.name}</Text>
                <Text style={styles.meta}>
                  {selectedRepository.relativeLocation}
                </Text>
              </View>
              <Badge
                tone={
                  selectedRepository.enrollment === "enrolled"
                    ? "success"
                    : "accent"
                }
              >
                {selectedRepository.enrollment === "enrolled"
                  ? "Managed"
                  : "New"}
              </Badge>
            </View>
            <Text style={styles.meta}>
              Choose bridge-detected actions. Paths, executables, arguments, and
              environment values cannot be entered from this app.
            </Text>
          </Card>
          <Label>Detected actions</Label>
          {candidates.map((candidate) => {
            const selected = selectedIds.includes(candidate.id);
            return (
              <Pressable
                key={candidate.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleCandidate(candidate)}
                style={({ pressed }) => [
                  styles.candidate,
                  selected && styles.candidateSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.row}>
                  <Text style={styles.candidateTitle}>
                    {selected ? "✓ " : ""}
                    {candidate.label}
                  </Text>
                  <Badge
                    tone={candidate.risk === "guarded" ? "warning" : "muted"}
                  >
                    {candidate.risk}
                  </Badge>
                </View>
                <Text style={styles.command}>{candidate.argvLabel}</Text>
                {candidate.scriptBody ? (
                  <Text style={styles.script}>
                    package script: {candidate.scriptBody}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  {candidate.source} · {candidate.operation}
                </Text>
              </Pressable>
            );
          })}
          {!candidates.length && !busy?.startsWith("options:") ? (
            <Text style={styles.meta}>
              No supported actions were detected. Add a strict
              .mobile-dev-cockpit.json manifest locally and refresh.
            </Text>
          ) : null}
          <Button
            disabled={selectedIds.length === 0}
            busy={busy === "proposal"}
            onPress={() => void requestEnrollment()}
          >
            {selectedRepository.enrollment === "enrolled"
              ? "Review update"
              : "Review enrollment"}
          </Button>
          {selectedRepository.enrolledProjectId ? (
            <Button
              variant="danger"
              busy={busy === "remove-proposal"}
              onPress={() => void requestRemoval()}
            >
              Review project removal
            </Button>
          ) : null}
        </>
      ) : (
        <Card>
          <Text style={styles.title}>Select a repository</Text>
          <Text style={styles.meta}>
            Discovery is read-only. Nothing becomes runnable until you review
            and approve its exact detected actions.
          </Text>
        </Card>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Button variant="secondary" onPress={() => router.back()}>
          Back
        </Button>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>Add project</Text>
          <Text style={styles.meta}>
            Bounded discovery · explicit enrollment
          </Text>
        </View>
      </View>
      {error || connection.error ? (
        <Text style={styles.error}>{error ?? connection.error}</Text>
      ) : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.page,
          { maxWidth: layout.contentMaxWidth },
          layout.mode === "regular" && styles.workspace,
        ]}
      >
        {layout.mode === "regular" ? (
          <>
            {list}
            {detail}
          </>
        ) : selectedRepository ? (
          <>
            <Button
              variant="secondary"
              onPress={() => {
                setSelectedRepository(undefined);
                setCandidates([]);
                setProposal(undefined);
              }}
            >
              Back to repositories
            </Button>
            {detail}
          </>
        ) : (
          list
        )}
      </ScrollView>
      {proposal ? (
        <View style={styles.approvalOverlay}>
          <Card elevated style={styles.approvalCard}>
            <Badge tone={proposal.action === "remove" ? "warning" : "accent"}>
              {proposal.action}
            </Badge>
            <Text style={styles.title}>{proposal.projectName}</Text>
            <Text style={styles.meta}>
              This one-use proposal expires{" "}
              {new Date(proposal.expiresAt).toLocaleTimeString()}. Enrollment
              saves configuration only; it does not run a command.
            </Text>
            <ScrollView style={styles.proposalCommands}>
              {proposal.candidates.map((candidate) => (
                <View key={candidate.id} style={styles.proposalLine}>
                  <Text style={styles.candidateTitle}>
                    {candidate.operation}
                  </Text>
                  <Text style={styles.command}>{candidate.argvLabel}</Text>
                  {candidate.scriptBody ? (
                    <Text style={styles.script}>{candidate.scriptBody}</Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            <View style={styles.approvalActions}>
              <View style={styles.flex}>
                <Button
                  variant="secondary"
                  onPress={() => void resolveProposal(false)}
                >
                  Cancel
                </Button>
              </View>
              <View style={styles.flex}>
                <Button
                  variant={proposal.action === "remove" ? "danger" : "primary"}
                  busy={busy === "resolve"}
                  onPress={() => void resolveProposal(true)}
                >
                  Approve {proposal.action}
                </Button>
              </View>
            </View>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.text, fontSize: 23, fontWeight: "800" },
  page: {
    width: "100%",
    alignSelf: "center",
    padding: 16,
    paddingBottom: 64,
    gap: 18,
  },
  workspace: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 28,
  },
  listPane: { gap: 10 },
  listPaneRegular: { width: 300 },
  detailPane: { flex: 1, minWidth: 0, gap: 12 },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    backgroundColor: colors.code,
    color: colors.text,
    paddingHorizontal: 13,
  },
  repository: {
    minWidth: 230,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.panel,
    padding: 13,
    gap: 5,
  },
  repositorySelected: {
    borderColor: colors.accent,
    backgroundColor: colors.panelRaised,
  },
  repositoryName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  candidate: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.panel,
    padding: 14,
    gap: 8,
  },
  candidateSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.panelRaised,
  },
  candidateTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  command: {
    color: colors.accent,
    backgroundColor: colors.code,
    borderRadius: 9,
    padding: 10,
    fontFamily: "Courier",
    fontSize: 11,
  },
  script: {
    color: colors.warning,
    fontFamily: "Courier",
    fontSize: 11,
    lineHeight: 16,
  },
  title: { color: colors.text, fontSize: 21, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  error: {
    color: colors.danger,
    fontSize: 13,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  approvalOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(3, 8, 17, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  approvalCard: { width: "100%", maxWidth: 680, maxHeight: "90%" },
  proposalLine: { gap: 6 },
  proposalCommands: { maxHeight: 380 },
  approvalActions: { flexDirection: "row", gap: 10 },
});
