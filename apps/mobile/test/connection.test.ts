import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  type MachineSnapshot,
} from "@mobile-dev-cockpit/protocol";
import { connectionReducer, type ConnectionState } from "../src/lib/connection";

const snapshot: MachineSnapshot = {
  machineName: "Mac",
  bridgeVersion: "0.1.0",
  protocolVersion: PROTOCOL_VERSION,
  projects: [
    {
      id: "site",
      name: "Site",
      capabilities: {
        dev: true,
        tunnel: true,
        build: true,
        test: true,
        agent: true,
        agentResume: true,
        deploy: true,
        rollback: false,
      },
      processes: {},
    },
  ],
};

const initial: ConnectionState = { status: "connected", snapshot, logs: [] };

describe("connectionReducer", () => {
  it("applies streamed process state to the matching project", () => {
    const state = connectionReducer(initial, {
      type: "event",
      event: {
        version: PROTOCOL_VERSION,
        type: "process",
        projectId: "site",
        process: { operation: "dev", phase: "running", recentLogs: [] },
      },
    });
    expect(state.snapshot?.projects[0]?.processes.dev?.phase).toBe("running");
  });

  it("bounds streamed logs", () => {
    let state = initial;
    for (let index = 0; index < 1_010; index += 1) {
      state = connectionReducer(state, {
        type: "event",
        event: {
          version: PROTOCOL_VERSION,
          type: "log",
          entry: {
            projectId: "site",
            operation: "dev",
            stream: "stdout",
            line: String(index),
            timestamp: String(index),
          },
        },
      });
    }
    expect(state.logs).toHaveLength(1_000);
    expect(state.logs[0]?.line).toBe("10");
  });

  it("recovers buffered logs from a reconnect snapshot", () => {
    const recovered: MachineSnapshot = {
      ...snapshot,
      projects: [
        {
          ...snapshot.projects[0]!,
          processes: {
            dev: {
              operation: "dev",
              phase: "running",
              recentLogs: [
                {
                  projectId: "site",
                  operation: "dev",
                  stream: "stdout",
                  line: "ready",
                  timestamp: "1",
                },
              ],
            },
          },
        },
      ],
    };
    const state = connectionReducer(initial, {
      type: "snapshot",
      snapshot: recovered,
    });
    expect(state.logs.map((entry) => entry.line)).toEqual(["ready"]);
  });
});
