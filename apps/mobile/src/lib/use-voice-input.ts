import { useCallback, useEffect, useReducer, useState } from "react";
import {
  addVoiceListener,
  cancelVoice,
  finishVoice,
  getVoiceCapabilities,
  requestVoicePermissions,
  startVoice,
} from "./voice";
import {
  initialVoiceState,
  voiceReducer,
  type VoiceCapabilities,
} from "./voice-state";

export function useVoiceInput(onFinalTranscript: (text: string) => void) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const [capabilities, setCapabilities] = useState<VoiceCapabilities>();

  useEffect(() => {
    let mounted = true;
    void getVoiceCapabilities().then((value) => {
      if (!mounted) return;
      setCapabilities(value);
      dispatch({ type: "capabilities", capabilities: value });
    });
    const subscription = addVoiceListener((event) => {
      dispatch({ type: "event", event });
      if (event.type === "transcript" && event.isFinal)
        onFinalTranscript(event.text);
    });
    return () => {
      mounted = false;
      subscription.remove();
      void cancelVoice();
    };
  }, [onFinalTranscript]);

  const requestPermissions = useCallback(async () => {
    const value = await requestVoicePermissions();
    setCapabilities(value);
    dispatch({ type: "capabilities", capabilities: value });
  }, []);

  const start = useCallback(async (allowAppleNetworkRecognition = false) => {
    dispatch({ type: "event", event: { type: "state", phase: "preparing" } });
    try {
      await startVoice({ allowAppleNetworkRecognition });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Voice input failed";
      dispatch({
        type: "event",
        event: {
          type: "error",
          code: message.toLowerCase().includes("on-device")
            ? "on_device_unavailable"
            : "start_failed",
          message,
          recoverable: true,
        },
      });
    }
  }, []);

  return {
    state,
    capabilities,
    requestPermissions,
    start,
    finish: finishVoice,
    cancel: cancelVoice,
    reset: () => dispatch({ type: "reset" }),
  };
}
