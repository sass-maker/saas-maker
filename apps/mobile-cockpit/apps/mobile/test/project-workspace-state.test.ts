import { describe, expect, it } from "vitest";
import {
  initialProjectWorkspaceState,
  projectWorkspaceReducer,
} from "../src/lib/project-workspace-state";

describe("projectWorkspaceReducer", () => {
  it("preserves selected section and draft across layout transitions", () => {
    const selected = projectWorkspaceReducer(initialProjectWorkspaceState, {
      type: "selectSection",
      section: "agent",
    });
    const drafted = projectWorkspaceReducer(selected, {
      type: "setInstruction",
      instruction: "Fix the tablet navigation",
    });
    expect(projectWorkspaceReducer(drafted, { type: "layoutChanged" })).toBe(
      drafted,
    );
  });

  it("appends final speech to editable text without sending it", () => {
    const drafted = projectWorkspaceReducer(initialProjectWorkspaceState, {
      type: "setInstruction",
      instruction: "Keep this context",
    });
    expect(
      projectWorkspaceReducer(drafted, {
        type: "appendTranscript",
        transcript: "make the header smaller",
      }).instruction,
    ).toBe("Keep this context\nmake the header smaller");
  });
});
