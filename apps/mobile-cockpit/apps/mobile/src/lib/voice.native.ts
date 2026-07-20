import { requireNativeModule } from "expo-modules-core";
import type { VoiceCapabilities, VoiceEvent } from "./voice-state";
import type { VoiceStartOptions, VoiceSubscription } from "./voice";

interface CockpitVoiceNativeMethods {
  capabilities(locale?: string): Promise<VoiceCapabilities>;
  requestPermissions(locale?: string): Promise<VoiceCapabilities>;
  start(options: VoiceStartOptions): Promise<void>;
  finish(): Promise<void>;
  cancel(): Promise<void>;
  addListener(
    event: "onVoiceEvent",
    listener: (event: VoiceEvent) => void,
  ): VoiceSubscription;
}

type CockpitVoiceNativeModule = CockpitVoiceNativeMethods;
const nativeModule =
  requireNativeModule<CockpitVoiceNativeModule>("CockpitVoice");

export const getVoiceCapabilities = (locale?: string) =>
  nativeModule.capabilities(locale);
export const requestVoicePermissions = (locale?: string) =>
  nativeModule.requestPermissions(locale);
export const startVoice = (options: VoiceStartOptions = {}) =>
  nativeModule.start(options);
export const finishVoice = () => nativeModule.finish();
export const cancelVoice = () => nativeModule.cancel();
export function addVoiceListener(
  listener: (event: VoiceEvent) => void,
): VoiceSubscription {
  return nativeModule.addListener("onVoiceEvent", listener);
}
