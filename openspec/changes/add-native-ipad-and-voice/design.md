## Context

The mobile app is an Expo SDK 57 / React Native 0.86 application with a native iOS build, Expo Router navigation, and one project screen that renders five operational sections. Its manifest currently opts out of tablet support and requires full-screen presentation. The agent composer accepts text only, although the existing `agentInstruction` protocol already carries exactly the final text a speech interface should produce.

This change should feel like an Apple app without replacing the proven connection, process, review, deployment, and WebView logic. Apple now provides a modern Speech stack on iOS 26 and retains a legacy Speech recognizer for the app's iOS 16.4 deployment floor. iPad windows are no longer fixed device canvases: they must tolerate portrait, landscape, Split View, Stage Manager, and freely resized windows.

## Goals / Non-Goals

**Goals:**

- Ship one universal binary that remains compact and focused on iPhone while providing an intentional regular-width iPad workspace.
- Adapt from actual window width so iPad multitasking and Stage Manager collapse gracefully instead of branching only on device model.
- Use Apple-native microphone capture and speech recognition with on-device recognition as the default.
- Keep voice input reviewable and explicit: the user sees and may edit a transcript before it becomes an agent instruction.
- Preserve the existing bridge protocol, repository allowlist, WebView isolation, and approval model.
- Add native simulator evidence for both iPhone and iPad.
- Launch a clean standalone Release build on both iOS 26.4 and iOS 27 when compiled with the iOS 27 SDK.

**Non-Goals:**

- Rewriting the complete app in SwiftUI or duplicating the bridge/domain layer in Swift.
- A wake word, always-listening microphone, background recording, or an open microphone while the app is suspended.
- Full-duplex voice conversation or automatically speaking raw PTY output; agent CLIs do not provide reliable structured response boundaries yet.
- Sending raw audio to the desktop bridge, an agent vendor, or a third-party transcription service.
- Android tablet or Android speech support.

## Decisions

### Keep React Native for the cockpit and use native code at platform boundaries

The existing TypeScript state and screens remain authoritative. A wholesale SwiftUI rewrite would duplicate the security-sensitive workflow and slow validation without improving the bridge contract. Native iOS code is used where React Native cannot provide the Apple experience directly: Speech, AVFAudio, permissions, audio interruptions, and platform capability reporting. Expo Router's native stack, native `WKWebView`, Safe Area integration, system share sheet, haptics where appropriate, and iOS controls remain in use.

Alternatives considered:

- **Full SwiftUI rewrite:** highest theoretical platform purity, but duplicates mature behavior and creates two implementations during migration.
- **Third-party React Native speech package:** faster initial wiring, but adds a production dependency around a sensitive permission boundary and often lags new Apple APIs.
- **Keyboard dictation only:** already works, but does not provide a dedicated, observable voice state or on-device policy.

### Add a local Expo Swift module with a versioned TypeScript facade

Create an app-local Expo Module that exposes a small contract:

- capability and authorization state;
- `requestPermissions()`;
- `start({ locale, allowAppleNetworkRecognition })`;
- `finish()` and `cancel()`;
- events for lifecycle, partial/final transcript, input level, and recoverable error.

The JavaScript facade owns a deterministic reducer so UI and permission states are testable without a microphone. A web implementation reports unsupported instead of mocking voice behavior.

No raw buffer crosses the React Native bridge. Swift owns the audio session and recognition pipeline, emits only transcript text and a normalized meter value, and tears down every audio tap on finish, cancellation, interruption, route change, or component unmount.

### Use SpeechAnalyzer on iOS 26+ with a legacy compatibility path

On iOS 26+, use `SpeechAnalyzer` with `SpeechTranscriber` and the appropriate locale assets. On iOS 16.4–25, use `SFSpeechRecognizer` with `SFSpeechAudioBufferRecognitionRequest`. The module checks whether on-device recognition is supported before setting the legacy request's `requiresOnDeviceRecognition` flag.

On-device recognition is the default. If the selected locale/device cannot recognize on-device, the UI does not silently upload audio. It offers an explicit Apple online-recognition choice with explanatory copy. Even when enabled, audio remains inside Apple's Speech service boundary and is never sent to the desktop bridge or another provider.

`AVAudioSession` and `AVAudioEngine` capture the microphone. The session is active only while the user is visibly recording and is released immediately afterward.

### Make voice push-to-talk and review-before-send

The agent composer gains a prominent microphone control, live waveform/meter, elapsed state, partial transcript, and Stop/Cancel actions. Stopping produces an editable transcript in the existing instruction field. Sending remains a separate explicit action through the existing `agentInstruction` message. This preserves the safety of the current visible PTY session and prevents recognition errors from becoming commands automatically.

The microphone is disabled when the agent is not running, but a captured transcript remains editable if the connection temporarily drops. Text entry remains available at all times.

### Adapt by window width, not device identity

The universal manifest enables iPad and removes the full-screen-only requirement. `useWindowDimensions` drives compact, intermediate, and regular layouts and responds to rotation and resizable iPad windows:

- **Compact:** retain the current phone stack and horizontally scrollable section tabs.
- **Intermediate:** widen content, reduce nesting, and allow paired summary/detail cards where they remain readable.
- **Regular:** render a persistent leading cockpit sidebar with machine/project state and section navigation, plus a flexible detail workspace.

The selected project and section are the same route/state regardless of layout, so resizing does not reset work. The preview expands to the detail workspace instead of retaining a fixed 600-point height.

### Let iPad orientation follow the window

On iPhone full-screen, the Preview control may continue to request portrait or landscape. On iPad, the app follows the system/window orientation and offers preview viewport presets inside the available canvas rather than forcing the entire device orientation. This keeps Split View and Stage Manager valid and avoids requiring full-screen iPad presentation.

### Add keyboard and pointer affordances without inventing a desktop UI

Core controls retain 44-point-or-larger targets, accessibility labels, and visible selection. Regular-width navigation exposes conventional keyboard actions for switching sections, sending an instruction, and cancelling voice capture where Expo/React Native's native command surface supports them. Pointer hover is additive; every action remains touch-accessible.

### Adopt a generated-project-safe single-window scene lifecycle

iOS 27 requires every app built with its SDK to adopt UIScene before the process may launch. Expo SDK 57 still generates a legacy AppDelegate that creates the window and starts React Native directly from `didFinishLaunchingWithOptions`, while this repository intentionally ignores generated native directories.

Add a local Expo config plugin that makes three deterministic prebuild changes:

- add a single-window `UIApplicationSceneManifest` to Info.plist with multiple scenes disabled;
- keep process-wide Expo/React Native factory initialization in AppDelegate, retain launch options, and implement `application(_:configurationForConnecting:options:)`;
- add a `UIWindowSceneDelegate` in the generated Swift source that owns the window, converts cold-start scene connection options into React Native launch options, starts React Native once for the connected application scene, and forwards later scene-delivered URLs and user activities through the existing AppDelegate/React Native linking path.

Keeping the scene delegate in the generated AppDelegate source avoids a separate Xcode-project file mutation. The plugin must be idempotent and must fail with an actionable error when Expo's generated template no longer matches, so an SDK upgrade cannot silently emit a half-migrated native app. `UIApplicationSupportsMultipleScenes` remains false because the cockpit has one authenticated connection and one authoritative navigation state; multiwindow would require a separate product/state design.

## Risks / Trade-offs

- [SpeechAnalyzer is unavailable below iOS 26] → Keep an availability-gated `SFSpeechRecognizer` implementation and test both facades with deterministic state fixtures.
- [On-device recognition varies by locale and device] → Query capabilities, show asset/preparation and unavailable states, and require explicit consent before Apple online recognition.
- [Microphone lifecycle bugs can leave an audio tap active] → Centralize teardown in Swift, make finish/cancel idempotent, handle interruptions and route changes, and add lifecycle tests around the TypeScript facade.
- [A custom React Native sidebar can feel less native than SwiftUI] → Follow Apple spacing/selection/sidebar behavior, use native navigation and system controls where available, and validate on real iPad window sizes; do not create ornamental desktop chrome.
- [A width breakpoint can churn during resize] → Use three stable layout bands with hysteresis-free pure derivation and preserve route/selection state across transitions.
- [Programmatic orientation conflicts with iPad multitasking] → Never lock iPad orientation; use in-canvas viewport presets there.
- [Raw terminal output is unsuitable for automatic speech synthesis] → Keep this change focused on voice input and defer spoken agent responses until the agent bridge has structured turn boundaries.
- [Expo template changes can invalidate a source transform] → Unit-test the pure transformation, make it idempotent, and fail prebuild loudly when expected anchors are absent instead of generating an unlaunchable native project.
- [Scene delivery can bypass legacy URL callbacks] → Forward scene URL and user-activity events through the existing AppDelegate handlers and verify both cold launch and normal launch on iOS 26.4 and iOS 27.

## Migration Plan

1. Add and validate the OpenSpec capability contracts.
2. Enable the universal manifest and introduce adaptive primitives while preserving the compact phone output.
3. Add the local Swift voice module, permissions, and a testable TypeScript facade.
4. Integrate push-to-talk into the agent composer and add iPad regular-width navigation/workspace layouts.
5. Run unit checks, exports, clean native prebuild/pod install, iPhone and iPad simulator builds, launches, screenshots, and representative width visual tests.
6. Generate from a clean native directory, build with Xcode 27, and launch the standalone Release app on iOS 26.4 and iOS 27 simulators.
7. Install on the paired iPhone and available iPad when Developer Mode/device availability permits; record any remaining hardware-only validation separately.

Rollback is removing the local voice module and adaptive layout wrapper and restoring the phone-only manifest. There is no server, protocol, data, credential, or production migration.

## Open Questions

- Automatic spoken agent responses remain intentionally deferred until the bridge can distinguish a clean assistant turn from prompts, progress, and terminal control output.
- A future iteration can consider App Intents/Shortcuts for starting a session, but it must not bypass pairing, project allowlists, or foreground approval gates.
