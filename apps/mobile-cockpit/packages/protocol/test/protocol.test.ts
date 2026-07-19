import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  ProtocolError,
  parseClientRequest,
} from "../src/index.js";

describe("parseClientRequest", () => {
  it("accepts a configured operation request", () => {
    expect(
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "startOperation",
        requestId: "r1",
        projectId: "site",
        operation: "dev",
      }),
    ).toMatchObject({ type: "startOperation", operation: "dev" });
  });

  it("rejects arbitrary command fields", () => {
    expect(() =>
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "startOperation",
        requestId: "r1",
        projectId: "site",
        operation: "dev",
        command: "rm -rf /",
      }),
    ).toThrowError(
      new ProtocolError("unknown_field", "Unexpected field: command"),
    );
  });

  it("accepts opaque enrollment candidates and rejects mobile paths or argv", () => {
    expect(
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "requestEnrollment",
        requestId: "enroll",
        repositoryId: "repo_123",
        candidateIds: ["candidate_1", "candidate_2"],
      }),
    ).toMatchObject({ type: "requestEnrollment" });
    for (const field of [
      "path",
      "workingDirectory",
      "executable",
      "argv",
      "command",
      "environment",
    ]) {
      expect(() =>
        parseClientRequest({
          version: PROTOCOL_VERSION,
          type: "requestEnrollment",
          requestId: `reject-${field}`,
          repositoryId: "repo_123",
          candidateIds: ["candidate_1"],
          [field]: field === "argv" ? ["sh"] : "/tmp/repo",
        }),
      ).toThrow(/Unexpected field/);
    }
  });

  it("bounds enrollment candidate selection", () => {
    expect(() =>
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "requestEnrollment",
        requestId: "empty",
        repositoryId: "repo_123",
        candidateIds: [],
      }),
    ).toThrow(/candidateIds/);
    expect(() =>
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "requestEnrollment",
        requestId: "duplicate",
        repositoryId: "repo_123",
        candidateIds: ["same", "same"],
      }),
    ).toThrow(/unique/);
  });

  it("requires approval-only operations to use the approval flow", () => {
    expect(() =>
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "startOperation",
        requestId: "r1",
        projectId: "site",
        operation: "deploy",
      }),
    ).toThrow(/Only dev, tunnel, build, test, or agent/);
  });

  it("requires a bounded commit message and a revert file target", () => {
    expect(() =>
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "requestApproval",
        requestId: "commit",
        projectId: "site",
        operation: "commit",
      }),
    ).toThrow(/message/);
    expect(() =>
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "requestApproval",
        requestId: "revert",
        projectId: "site",
        operation: "revert",
      }),
    ).toThrow(/file/);
  });

  it("bounds and validates screenshot attachments", () => {
    expect(
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "agentAttachment",
        requestId: "attachment",
        projectId: "site",
        mimeType: "image/jpeg",
        base64: "/9j/2Q==",
      }),
    ).toMatchObject({ type: "agentAttachment", mimeType: "image/jpeg" });
    expect(() =>
      parseClientRequest({
        version: PROTOCOL_VERSION,
        type: "agentAttachment",
        requestId: "attachment",
        projectId: "site",
        mimeType: "image/jpeg",
        base64: "not base64",
      }),
    ).toThrow(/canonical base64/);
  });
});
