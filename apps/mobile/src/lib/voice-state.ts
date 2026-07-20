type VoicePhase =
  | "unsupported"
  | "idle"
  | "permissionRequired"
  | "preparing"
  | "listening"
  | "finalizing"
  | "ready"
  | "cancelled"
  | "networkOptInRequired"
  | "error";

export interface VoiceCapabilities {
  supported: boolean;
  authorization: "notDetermined" | "denied" | "restricted" | "authorized";
  onDeviceAvailable: boolean;
  analyzerAvailable: boolean;
  locale: string;
}

export type VoiceEvent =
  | { type: "state"; phase: VoicePhase }
  | { type: "transcript"; text: string; isFinal: boolean }
  | { type: "meter"; level: number }
  | { type: "error"; code: string; message: string; recoverable: boolean };

export interface VoiceState {
  phase: VoicePhase;
  transcript: string;
  partialTranscript: string;
  meter: number;
  error?: string;
  errorCode?: string;
}

export const initialVoiceState: VoiceState = {
  phase: "idle",
  transcript: "",
  partialTranscript: "",
  meter: 0,
};

export type VoiceAction =
  | { type: "capabilities"; capabilities: VoiceCapabilities }
  | { type: "event"; event: VoiceEvent }
  | { type: "reset" };

export function voiceReducer(
  state: VoiceState,
  action: VoiceAction,
): VoiceState {
  if (action.type === "reset") return initialVoiceState;
  if (action.type === "capabilities") {
    if (!action.capabilities.supported)
      return { ...initialVoiceState, phase: "unsupported" };
    if (action.capabilities.authorization !== "authorized")
      return { ...initialVoiceState, phase: "permissionRequired" };
    return state.phase === "unsupported" || state.phase === "permissionRequired"
      ? { ...initialVoiceState, phase: "idle" }
      : state;
  }
  const event = action.event;
  if (event.type === "state")
    return {
      ...state,
      phase: event.phase,
      meter: ["listening", "preparing"].includes(event.phase) ? state.meter : 0,
      error: event.phase === "error" ? state.error : undefined,
    };
  if (event.type === "meter")
    return { ...state, meter: Math.max(0, Math.min(1, event.level)) };
  if (event.type === "transcript")
    return event.isFinal
      ? {
          ...state,
          phase: "ready",
          transcript: event.text,
          partialTranscript: "",
          meter: 0,
        }
      : { ...state, partialTranscript: event.text };
  return {
    ...state,
    phase:
      event.code === "on_device_unavailable" ? "networkOptInRequired" : "error",
    error: event.message,
    errorCode: event.code,
    meter: 0,
  };
}
