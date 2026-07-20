## Why

Mobile Dev Cockpit already proves the remote edit-to-deploy loop on an iPhone-sized surface, but its phone-only manifest and text-only agent input waste the iPad's workspace and make hands-busy supervision unnecessarily slow. The next product step is a universal Apple-platform cockpit that feels intentional on a resizable iPad and lets a developer speak instructions through Apple's native speech stack without adding a third-party voice service.

## What Changes

- Ship the existing iOS app as a universal iPhone/iPad app with compact and regular-width layouts that adapt across portrait, landscape, Split View, and Stage Manager sizes.
- Replace the iPad's stretched single-column project screen with a native-style persistent navigation rail/sidebar and a detail workspace that prioritizes preview, agent output, review, and deployment content.
- Let the preview use the available iPad workspace while preserving explicit phone portrait/landscape testing controls and WebView isolation.
- Add a dedicated push-to-talk agent composer with live transcription, permission and availability states, editable review, cancel, and explicit send.
- Implement speech capture in a local Swift/Expo module using Apple's public Speech and AVFAudio frameworks: `SpeechAnalyzer`/`SpeechTranscriber` on iOS 26+ and `SFSpeechRecognizer` compatibility behavior on older supported iOS versions.
- Prefer on-device recognition, disclose when a locale/device cannot satisfy it, and never send microphone audio to the desktop bridge or a third-party speech provider.
- Keep the existing text composer available and keep every agent instruction subject to the same authenticated bridge and visible PTY session boundaries.
- Add iPad and voice state tests, native build gates, and visual verification at representative compact and regular widths.
- Adopt UIKit's required single-window scene lifecycle through an idempotent Expo config plugin so clean prebuilds made with the iOS 27 SDK launch on iOS 27 while retaining the supported iOS 16.4 floor.

## Capabilities

### New Capabilities

- `adaptive-ipad-cockpit`: Universal iPad support, size-class-driven navigation and content layout, resizable-window behavior, and preview sizing across portrait and landscape.
- `native-voice-control`: Apple-native microphone authorization, on-device-first live transcription, editable push-to-talk agent instructions, cancellation, and safe text-only bridge delivery.

### Modified Capabilities

None. The original MVP change remains the iPhone contract; these additive capabilities extend it without changing the bridge protocol or trust boundary.

## Impact

- `apps/mobile/app.json` becomes universal and allows iPad multitasking instead of requiring a phone-only full-screen presentation.
- The home and project routes gain shared adaptive layout primitives and regular-width navigation.
- A local iOS Swift module is added under the mobile app and linked through Expo Modules; no third-party production speech dependency or hosted voice service is introduced.
- The generated iOS project gains microphone and speech-recognition usage descriptions through Expo configuration.
- The generated AppDelegate and Info.plist gain a single-window UIScene integration at prebuild time; ignored native output remains reproducible and no hand-edited Xcode project becomes a source of truth.
- CI and tests expand to cover an iPad simulator build/launch and representative portrait, landscape, and resized-window layouts.
- The desktop bridge and shared wire protocol remain unchanged because only the final transcript text is sent as an existing `agentInstruction` request.
