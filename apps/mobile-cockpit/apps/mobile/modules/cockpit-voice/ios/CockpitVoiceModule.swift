import AVFAudio
import ExpoModulesCore
import Speech

private typealias VoiceEmitter = (_ event: [String: Any]) -> Void

private enum VoiceFailure: LocalizedError {
  case unauthorized
  case unavailable
  case onDeviceUnavailable
  case alreadyRunning

  var errorDescription: String? {
    switch self {
    case .unauthorized: return "Microphone and Speech permissions are required"
    case .unavailable: return "Apple Speech is unavailable for this locale"
    case .onDeviceUnavailable:
      return
        "On-device recognition is unavailable. Explicitly allow Apple online recognition to continue."
    case .alreadyRunning: return "Voice capture is already running"
    }
  }
}

private func authorizationLabel(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
  switch status {
  case .notDetermined: return "notDetermined"
  case .denied: return "denied"
  case .restricted: return "restricted"
  case .authorized: return "authorized"
  @unknown default: return "restricted"
  }
}

private func combinedAuthorizationLabel() -> String {
  let speech = SFSpeechRecognizer.authorizationStatus()
  switch AVAudioSession.sharedInstance().recordPermission {
  case .denied: return "denied"
  case .undetermined:
    return speech == .denied || speech == .restricted
      ? authorizationLabel(speech)
      : "notDetermined"
  case .granted: return authorizationLabel(speech)
  @unknown default: return "restricted"
  }
}

private func normalizedLevel(_ buffer: AVAudioPCMBuffer) -> Double {
  guard let channel = buffer.floatChannelData?.pointee else { return 0 }
  let frames = Int(buffer.frameLength)
  guard frames > 0 else { return 0 }
  var sum: Float = 0
  for index in 0..<frames {
    let sample = channel[index]
    sum += sample * sample
  }
  let rms = sqrt(sum / Float(frames))
  let decibels = 20 * log10(max(rms, 0.000_01))
  return Double(max(0, min(1, (decibels + 55) / 55)))
}

@available(iOS 26.0, *)
@MainActor
private final class ModernSpeechSession {
  private let engine = AVAudioEngine()
  private let emitter: VoiceEmitter
  private var analyzer: SpeechAnalyzer?
  private var inputContinuation: AsyncStream<AnalyzerInput>.Continuation?
  private var analysisTask: Task<Void, Never>?
  private var resultsTask: Task<Void, Never>?

  init(emitter: @escaping VoiceEmitter) {
    self.emitter = emitter
  }

  func start(locale requestedLocale: Locale) async throws {
    guard SpeechTranscriber.isAvailable,
      let locale = await SpeechTranscriber.supportedLocale(equivalentTo: requestedLocale)
    else { throw VoiceFailure.unavailable }

    let transcriber = SpeechTranscriber(locale: locale, preset: .progressiveTranscription)
    let modules: [any SpeechModule] = [transcriber]
    let status = await AssetInventory.status(forModules: modules)
    if status != .installed {
      guard
        let installation = try await AssetInventory.assetInstallationRequest(supporting: modules)
      else { throw VoiceFailure.unavailable }
      try await installation.downloadAndInstall()
    }
    _ = try await AssetInventory.reserve(locale: locale)

    let analyzer = SpeechAnalyzer(modules: modules)
    let input = engine.inputNode
    let naturalFormat = input.outputFormat(forBus: 0)
    let format =
      await SpeechAnalyzer.bestAvailableAudioFormat(
        compatibleWith: modules,
        considering: naturalFormat
      ) ?? naturalFormat
    try await analyzer.prepareToAnalyze(in: format)
    let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
    self.analyzer = analyzer
    self.inputContinuation = continuation

    resultsTask = Task { [weak self] in
      do {
        for try await result in transcriber.results {
          let text = String(result.text.characters)
          await MainActor.run {
            self?.emitter([
              "type": "transcript",
              "text": text,
              "isFinal": result.isFinal,
            ])
          }
        }
      } catch {
        await MainActor.run {
          self?.emitter([
            "type": "error",
            "code": "recognition_failed",
            "message": error.localizedDescription,
            "recoverable": true,
          ])
        }
      }
    }
    analysisTask = Task { [weak self] in
      do {
        try await analyzer.start(inputSequence: stream)
      } catch {
        await MainActor.run {
          self?.emitter([
            "type": "error",
            "code": "analysis_failed",
            "message": error.localizedDescription,
            "recoverable": true,
          ])
        }
      }
    }

    input.installTap(onBus: 0, bufferSize: 1_024, format: format) { [weak self] buffer, _ in
      self?.inputContinuation?.yield(AnalyzerInput(buffer: buffer))
      let level = normalizedLevel(buffer)
      Task { @MainActor [weak self] in
        self?.emitter(["type": "meter", "level": level])
      }
    }
    engine.prepare()
    try engine.start()
  }

  func finish() async {
    stopAudio()
    inputContinuation?.finish()
    do {
      try await analyzer?.finalizeAndFinishThroughEndOfInput()
    } catch {
      emitter([
        "type": "error",
        "code": "finalize_failed",
        "message": error.localizedDescription,
        "recoverable": true,
      ])
    }
    _ = await analysisTask?.result
    _ = await resultsTask?.result
    clear()
  }

  func cancel() async {
    stopAudio()
    inputContinuation?.finish()
    await analyzer?.cancelAndFinishNow()
    clear()
  }

  private func stopAudio() {
    if engine.isRunning { engine.stop() }
    engine.inputNode.removeTap(onBus: 0)
  }

  private func clear() {
    inputContinuation = nil
    analysisTask?.cancel()
    resultsTask?.cancel()
    analysisTask = nil
    resultsTask = nil
    analyzer = nil
  }
}

@MainActor
private final class VoiceController {
  private let emitter: VoiceEmitter
  private let engine = AVAudioEngine()
  private var legacyRequest: SFSpeechAudioBufferRecognitionRequest?
  private var legacyTask: SFSpeechRecognitionTask?
  private var modernSession: AnyObject?
  private var running = false
  private var interruptionObserver: NSObjectProtocol?
  private var routeObserver: NSObjectProtocol?

  init(emitter: @escaping VoiceEmitter) {
    self.emitter = emitter
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      Task { @MainActor in await self?.interrupt(code: "audio_interrupted") }
    }
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      Task { @MainActor in await self?.interrupt(code: "audio_route_changed") }
    }
  }

  deinit {
    if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) }
    if let routeObserver { NotificationCenter.default.removeObserver(routeObserver) }
  }

  func capabilities(locale identifier: String?) async -> [String: Any] {
    let locale = Locale(identifier: identifier ?? Locale.current.identifier)
    let recognizer = SFSpeechRecognizer(locale: locale)
    var analyzerAvailable = false
    var onDeviceAvailable = recognizer?.supportsOnDeviceRecognition ?? false
    if #available(iOS 26.0, *) {
      let analyzerLocale = await SpeechTranscriber.supportedLocale(equivalentTo: locale)
      analyzerAvailable = SpeechTranscriber.isAvailable && analyzerLocale != nil
      onDeviceAvailable = analyzerAvailable
    }
    return [
      "supported": recognizer != nil || analyzerAvailable,
      "authorization": combinedAuthorizationLabel(),
      "onDeviceAvailable": onDeviceAvailable,
      "analyzerAvailable": analyzerAvailable,
      "locale": locale.identifier,
    ]
  }

  func requestPermissions(locale: String?) async -> [String: Any] {
    _ = await withCheckedContinuation { continuation in
      AVAudioSession.sharedInstance().requestRecordPermission { allowed in
        continuation.resume(returning: allowed)
      }
    }
    _ = await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { status in
        continuation.resume(returning: status)
      }
    }
    return await capabilities(locale: locale)
  }

  func start(locale identifier: String?, allowNetwork: Bool) async throws {
    if running { throw VoiceFailure.alreadyRunning }
    guard SFSpeechRecognizer.authorizationStatus() == .authorized,
      AVAudioSession.sharedInstance().recordPermission == .granted
    else { throw VoiceFailure.unauthorized }
    let locale = Locale(identifier: identifier ?? Locale.current.identifier)
    try activateAudioSession()
    emitter(["type": "state", "phase": "preparing"])
    running = true
    do {
      if #available(iOS 26.0, *) {
        let session = ModernSpeechSession(emitter: emitter)
        modernSession = session
        try await session.start(locale: locale)
      } else {
        try startLegacy(locale: locale, allowNetwork: allowNetwork)
      }
      emitter(["type": "state", "phase": "listening"])
    } catch {
      running = false
      await teardownAudioSession()
      if case VoiceFailure.onDeviceUnavailable = error {
        emitter([
          "type": "error",
          "code": "on_device_unavailable",
          "message": error.localizedDescription,
          "recoverable": true,
        ])
      }
      throw error
    }
  }

  func finish() async {
    guard running else { return }
    emitter(["type": "state", "phase": "finalizing"])
    if #available(iOS 26.0, *), let session = modernSession as? ModernSpeechSession {
      await session.finish()
    } else {
      if engine.isRunning { engine.stop() }
      engine.inputNode.removeTap(onBus: 0)
      legacyRequest?.endAudio()
    }
    running = false
    await teardownAudioSession()
  }

  func cancel() async {
    guard running || legacyTask != nil || modernSession != nil else { return }
    if #available(iOS 26.0, *), let session = modernSession as? ModernSpeechSession {
      await session.cancel()
    }
    if engine.isRunning { engine.stop() }
    engine.inputNode.removeTap(onBus: 0)
    legacyRequest?.endAudio()
    legacyTask?.cancel()
    legacyTask = nil
    legacyRequest = nil
    modernSession = nil
    running = false
    await teardownAudioSession()
    emitter(["type": "state", "phase": "cancelled"])
  }

  private func startLegacy(locale: Locale, allowNetwork: Bool) throws {
    guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable
    else { throw VoiceFailure.unavailable }
    if !recognizer.supportsOnDeviceRecognition && !allowNetwork {
      throw VoiceFailure.onDeviceUnavailable
    }
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.requiresOnDeviceRecognition = !allowNetwork
    legacyRequest = request
    legacyTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
      Task { @MainActor in
        guard let self else { return }
        if let result {
          self.emitter([
            "type": "transcript",
            "text": result.bestTranscription.formattedString,
            "isFinal": result.isFinal,
          ])
        }
        if let error {
          self.emitter([
            "type": "error",
            "code": "recognition_failed",
            "message": error.localizedDescription,
            "recoverable": true,
          ])
          await self.cancel()
        } else if result?.isFinal == true {
          self.legacyTask = nil
          self.legacyRequest = nil
        }
      }
    }
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    input.installTap(onBus: 0, bufferSize: 1_024, format: format) { [weak self] buffer, _ in
      self?.legacyRequest?.append(buffer)
      let level = normalizedLevel(buffer)
      Task { @MainActor [weak self] in
        self?.emitter(["type": "meter", "level": level])
      }
    }
    engine.prepare()
    try engine.start()
  }

  private func activateAudioSession() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
    try session.setActive(true, options: .notifyOthersOnDeactivation)
  }

  private func teardownAudioSession() async {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    modernSession = nil
  }

  private func interrupt(code: String) async {
    guard running else { return }
    await cancel()
    emitter([
      "type": "error",
      "code": code,
      "message": "Voice capture stopped because the audio route changed or was interrupted.",
      "recoverable": true,
    ])
  }
}

public final class CockpitVoiceModule: Module {
  @MainActor private lazy var controller = VoiceController { [weak self] event in
    self?.sendEvent("onVoiceEvent", event)
  }

  public func definition() -> ModuleDefinition {
    Name("CockpitVoice")
    Events("onVoiceEvent")

    AsyncFunction("capabilities") { (locale: String?) async -> [String: Any] in
      await self.controller.capabilities(locale: locale)
    }
    AsyncFunction("requestPermissions") { (locale: String?) async -> [String: Any] in
      await self.controller.requestPermissions(locale: locale)
    }
    AsyncFunction("start") { (options: [String: Any]) async throws in
      try await self.controller.start(
        locale: options["locale"] as? String,
        allowNetwork: options["allowAppleNetworkRecognition"] as? Bool ?? false
      )
    }
    AsyncFunction("finish") {
      await self.controller.finish()
    }
    AsyncFunction("cancel") {
      await self.controller.cancel()
    }
    OnDestroy {
      Task { @MainActor in await self.controller.cancel() }
    }
  }
}
