import type { VoiceCapabilities, VoiceEvent } from "./voice-state";

export interface VoiceStartOptions {
  locale?: string;
  allowAppleNetworkRecognition?: boolean;
}

export interface VoiceSubscription {
  remove(): void;
}

export async function getVoiceCapabilities(): Promise<VoiceCapabilities> {
  return {
    supported: false,
    authorization: "restricted",
    onDeviceAvailable: false,
    analyzerAvailable: false,
    locale: "en-US",
  };
}

export async function requestVoicePermissions(): Promise<VoiceCapabilities> {
  return getVoiceCapabilities();
}

export async function startVoice(
  _options: VoiceStartOptions = {},
): Promise<void> {
  throw new Error("Native Apple Speech is unavailable on this platform");
}

export async function finishVoice(): Promise<void> {}
export async function cancelVoice(): Promise<void> {}
export function addVoiceListener(
  _listener: (event: VoiceEvent) => void,
): VoiceSubscription {
  return { remove() {} };
}
