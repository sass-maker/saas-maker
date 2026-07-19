import { describe, expect, it } from "vitest";
import { initialVoiceState, voiceReducer } from "../src/lib/voice-state";

describe("voiceReducer", () => {
  it("keeps partial speech reviewable and promotes only a final transcript", () => {
    const listening = voiceReducer(initialVoiceState, {
      type: "event",
      event: { type: "state", phase: "listening" },
    });
    const partial = voiceReducer(listening, {
      type: "event",
      event: { type: "transcript", text: "change the", isFinal: false },
    });
    expect(partial).toMatchObject({
      phase: "listening",
      partialTranscript: "change the",
    });
    expect(
      voiceReducer(partial, {
        type: "event",
        event: { type: "transcript", text: "change the header", isFinal: true },
      }),
    ).toMatchObject({
      phase: "ready",
      transcript: "change the header",
      partialTranscript: "",
    });
  });

  it("requires explicit Apple online recognition after on-device failure", () => {
    expect(
      voiceReducer(initialVoiceState, {
        type: "event",
        event: {
          type: "error",
          code: "on_device_unavailable",
          message: "On-device recognition is unavailable",
          recoverable: true,
        },
      }).phase,
    ).toBe("networkOptInRequired");
  });

  it("reports unsupported and permission-required capabilities deterministically", () => {
    expect(
      voiceReducer(initialVoiceState, {
        type: "capabilities",
        capabilities: {
          supported: false,
          authorization: "restricted",
          onDeviceAvailable: false,
          analyzerAvailable: false,
          locale: "en-US",
        },
      }).phase,
    ).toBe("unsupported");
    expect(
      voiceReducer(initialVoiceState, {
        type: "capabilities",
        capabilities: {
          supported: true,
          authorization: "denied",
          onDeviceAvailable: true,
          analyzerAvailable: false,
          locale: "en-US",
        },
      }).phase,
    ).toBe("permissionRequired");
  });
});
