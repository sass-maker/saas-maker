## 1. Universal app foundation

- [x] 1.1 Enable universal iPhone/iPad support, all required orientations, iPad multitasking, and microphone/speech usage descriptions in Expo configuration
- [x] 1.2 Add pure compact/intermediate/regular layout derivation and tests for representative iPhone, iPad portrait, iPad landscape, Split View, and Stage Manager widths
- [x] 1.3 Add reusable adaptive cockpit, sidebar/navigation, and detail workspace primitives that preserve route and draft state while resizing

## 2. Native iPad cockpit

- [x] 2.1 Adapt onboarding and project selection to compact and regular-width presentations without stretching phone cards across the iPad canvas
- [x] 2.2 Adapt the project route to persistent regular-width section navigation with a flexible detail workspace and visible selection state
- [x] 2.3 Replace the fixed preview height with window-aware sizing and add iPad in-canvas portrait/landscape preview presets without locking system orientation
- [x] 2.4 Add touch, pointer, Dynamic Type, scrolling, and supported hardware-keyboard affordances for core iPad navigation and agent actions
- [x] 2.5 Add component/reducer tests proving project, section, and draft preservation across layout transitions

## 3. Apple-native voice module

- [x] 3.1 Create an app-local Expo Swift module and typed TypeScript facade for voice capabilities, permissions, start, finish, cancel, state, transcript, meter, and errors
- [x] 3.2 Implement AVAudioSession/AVAudioEngine capture with idempotent teardown for finish, cancel, interruption, route change, and unmount
- [x] 3.3 Implement the iOS 26+ SpeechAnalyzer/SpeechTranscriber path with locale asset preparation and partial/final transcript events
- [x] 3.4 Implement the iOS 16.4–25 SFSpeechRecognizer path with on-device capability checks and the same event contract
- [x] 3.5 Enforce on-device recognition by default and require explicit UI opt-in before Apple online recognition when the locale/device cannot remain on-device
- [x] 3.6 Add a deterministic web/unsupported implementation and native-facade tests that never require live microphone hardware

## 4. Dedicated voice interface

- [x] 4.1 Add the push-to-talk composer with permission, preparing, listening, finalizing, ready, cancelled, and error states plus visible input activity
- [x] 4.2 Preserve text entry, place finalized speech into an editable draft, and require the existing explicit Send action before agentInstruction delivery
- [x] 4.3 Preserve finalized transcripts across bridge reconnects, disable unavailable actions safely, and stop capture when leaving the project
- [x] 4.4 Add UI/state tests for permission denial, on-device unavailability, Apple online opt-in, partial/final transcript, cancellation, interruption, reconnect, and send

## 5. Native and visual verification

- [x] 5.1 Run formatting, lint, typecheck, unit tests, bridge build, web export, and iOS export
- [x] 5.2 Generate a clean native project, install pods, and compile the local Swift voice module for generic iOS Simulator with Xcode 26.4 or newer
- [x] 5.3 Build, install, and launch standalone Release apps in representative iPhone and iPad simulators without Metro
- [x] 5.4 Capture and visually inspect iPhone portrait/landscape plus iPad portrait/landscape and compact multitasking screenshots
- [x] 5.5 Verify VoiceOver labels, Dynamic Type reachability, pointer/touch targets, keyboard behavior, and microphone release after every terminal voice state
- [ ] 5.6 Install on available physical iPhone/iPad hardware and verify permissions, on-device transcription, interruption teardown, rotation/resize, reconnect, WebView preview, and screenshot-to-agent flow

## 6. Handoff

- [x] 6.1 Update README setup/privacy guidance and PROJECT_STATUS.md with universal iPad and native voice evidence plus any physical-device-only residual risk
- [ ] 6.2 Validate the OpenSpec change strictly and archive it only after all required scenarios have direct evidence
- [ ] 6.3 Commit and push the reviewed implementation with the relevant CI checks green
