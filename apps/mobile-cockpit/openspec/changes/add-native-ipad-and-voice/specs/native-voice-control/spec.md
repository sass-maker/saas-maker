## ADDED Requirements

### Requirement: Apple-native speech pipeline

The iOS app SHALL capture and transcribe visible push-to-talk sessions using Apple's public Speech and AVFAudio frameworks through an app-local native module and SHALL NOT send raw microphone audio to the desktop bridge or a third-party provider.

#### Scenario: Transcribe on iOS 26 or later

- **WHEN** the user starts voice input on a supported iOS 26-or-later device and locale
- **THEN** the native module uses the modern SpeechAnalyzer transcription path and emits transcript text without emitting raw audio to JavaScript or the bridge

#### Scenario: Transcribe on an older supported iOS version

- **WHEN** the user starts voice input on iOS 16.4 through iOS 25
- **THEN** the native module uses the supported SFSpeechRecognizer compatibility path with the same JavaScript-facing lifecycle

### Requirement: Explicit microphone and speech authorization

The voice interface MUST request microphone and speech-recognition permission in context, explain why they are needed, and remain usable through text when either permission is denied or restricted.

#### Scenario: Grant permissions

- **WHEN** the user invokes voice input for the first time and grants both system permissions
- **THEN** the app proceeds to a ready or preparing state and does not ask again unnecessarily

#### Scenario: Deny a permission

- **WHEN** microphone or speech permission is denied or restricted
- **THEN** the app shows an actionable unavailable state, offers the relevant Settings path when possible, and leaves text instruction entry enabled

### Requirement: On-device-first recognition

The app MUST prefer on-device recognition and MUST NOT silently use Apple network recognition when the selected device or locale cannot satisfy an on-device request.

#### Scenario: On-device recognition is available

- **WHEN** the selected locale supports on-device recognition
- **THEN** the app performs the session on-device and labels that privacy state in the voice UI

#### Scenario: On-device recognition is unavailable

- **WHEN** the selected locale or device requires Apple's online recognition service
- **THEN** the app stops before recording or recognition, explains the limitation, and requires an explicit per-setting opt-in before allowing Apple online recognition

### Requirement: Observable push-to-talk lifecycle

The voice composer SHALL show idle, requesting-permission, preparing, listening, finalizing, ready, cancelled, and error states with a visible microphone indicator, partial transcript, and cancellation control while audio capture is active.

#### Scenario: Start listening

- **WHEN** an active agent session exists and the user taps the microphone control
- **THEN** the app activates the microphone, displays a listening state and input activity, and streams partial transcript updates

#### Scenario: Audio session is interrupted

- **WHEN** a call, route change, app lifecycle transition, or system interruption stops audio capture
- **THEN** the module tears down its audio tap, preserves any safe transcript produced so far, and reports a recoverable stopped or error state

#### Scenario: Cancel listening

- **WHEN** the user cancels a voice session
- **THEN** the app immediately releases the microphone and discards that session's uncommitted transcript

### Requirement: Review before sending

The app MUST place a finalized voice transcript into an editable instruction composer and MUST require a separate explicit send action before transmitting it as an existing authenticated agent instruction.

#### Scenario: Finish a voice instruction

- **WHEN** the user stops a successful voice session
- **THEN** the finalized transcript appears in the editable instruction field and no bridge request is sent automatically

#### Scenario: Edit and send transcript

- **WHEN** the user edits the finalized transcript and taps Send while the agent is active and the bridge is connected
- **THEN** the app sends only the final text through the existing agentInstruction request and clears the composer after acceptance

#### Scenario: Connection drops after transcription

- **WHEN** the bridge disconnects after a transcript is finalized but before it is sent
- **THEN** the app preserves the editable transcript and disables sending until the authenticated connection recovers

### Requirement: Idempotent audio teardown

The native voice module MUST release microphone input taps, recognition tasks, audio sessions, timers, and event streams after finish, cancellation, error, interruption, or view unmount.

#### Scenario: Stop repeatedly

- **WHEN** finish or cancel is invoked more than once for the same session
- **THEN** teardown completes without a crash, leaked audio capture, or duplicate final transcript event

#### Scenario: Leave the project screen

- **WHEN** the user navigates away while voice capture is active
- **THEN** capture stops and the operating system no longer shows the app as using the microphone
