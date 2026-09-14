import Foundation
#if canImport(Speech) && canImport(AVFoundation) && (os(iOS) || os(macOS))
@preconcurrency import Speech
@preconcurrency import AVFoundation
#endif

/// Apple-only adapter. Constructing it neither requests permission nor opens audio.
/// No URL input, remote fallback, transcript history or diagnostic text is exposed.
@MainActor
public final class AppleLocalSpeechCapture: SpeechCapturing {
    private let locale: Locale
    private var generation = UUID()
    #if canImport(Speech) && canImport(AVFoundation) && (os(iOS) || os(macOS))
    private var resources: LocalSpeechResources?
    #endif

    public init(locale: Locale = Locale(identifier: "en-GB")) { self.locale = locale }

    public var availability: SpeechAvailability {
        #if canImport(Speech) && canImport(AVFoundation) && (os(iOS) || os(macOS))
        guard let recognizer = SFSpeechRecognizer(locale: locale) else { return .localeUnsupported }
        guard recognizer.supportsOnDeviceRecognition else { return .onDeviceUnavailable }
        return recognizer.isAvailable ? .available : .temporarilyUnavailable
        #else
        return .frameworkUnavailable
        #endif
    }

    public func permission(_ kind: SpeechPermission) -> SpeechPermissionStatus {
        #if canImport(Speech) && canImport(AVFoundation) && (os(iOS) || os(macOS))
        switch kind {
        case .recognition: return Self.status(SFSpeechRecognizer.authorizationStatus())
        case .microphone:
            switch AVCaptureDevice.authorizationStatus(for: .audio) {
            case .authorized: return .granted
            case .notDetermined: return .undetermined
            case .denied: return .denied
            case .restricted: return .restricted
            @unknown default: return .restricted
            }
        }
        #else
        return .restricted
        #endif
    }

    /// The coordinator invokes this only within the user's explicit start request.
    public func requestPermission(_ kind: SpeechPermission,
                                  completion: @escaping @MainActor (SpeechPermissionStatus) -> Void) {
        #if canImport(Speech) && canImport(AVFoundation) && (os(iOS) || os(macOS))
        switch kind {
        case .recognition:
            SFSpeechRecognizer.requestAuthorization { status in
                Task { @MainActor in completion(Self.status(status)) }
            }
        case .microphone:
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                Task { @MainActor in completion(granted ? .granted : .denied) }
            }
        }
        #else
        completion(.restricted)
        #endif
    }

    public func begin(maximumTranscriptBytes: Int,
                      receive: @escaping @MainActor (SpeechCaptureEvent) -> Void) throws {
        guard (1...4096).contains(maximumTranscriptBytes) else { throw SpeechCaptureFailure.transcriptLimit }
        if let error = end() { throw error }
        guard permission(.microphone) == .granted, permission(.recognition) == .granted else {
            throw SpeechCaptureFailure.permissionDenied
        }
        #if canImport(Speech) && canImport(AVFoundation) && (os(iOS) || os(macOS))
        guard let recognizer = SFSpeechRecognizer(locale: locale),
              recognizer.supportsOnDeviceRecognition, recognizer.isAvailable else {
            throw SpeechCaptureFailure.unavailable
        }
        let id = generation
        let owned = LocalSpeechResources(recognizer: recognizer)
        resources = owned
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        request.addsPunctuation = false
        owned.setRequest(request)
        do {
            #if os(iOS)
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker])
            try session.setActive(true)
            owned.ownsAudioSession = true
            #endif
            let input = owned.engine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { throw SpeechCaptureFailure.audioStart }
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak owned] buffer, _ in
                owned?.append(buffer)
            }
            owned.hasTap = true
            recognizer.queue = .main
            owned.task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                // Apple's recognizer.queue guarantees this callback runs on main.
                MainActor.assumeIsolated {
                    guard let self, self.generation == id else { return }
                    if error != nil {
                        let cleanup = self.end()
                        receive(.failure(cleanup ?? .recognition))
                        return
                    }
                    guard let result else { return }
                    let text = result.bestTranscription.formattedString
                    guard text.utf8.count <= maximumTranscriptBytes else {
                        let cleanup = self.end()
                        receive(.failure(cleanup ?? .transcriptLimit))
                        return
                    }
                    if result.isFinal, let cleanup = self.end() {
                        receive(.failure(cleanup)); return
                    }
                    receive(.transcript(text, isFinal: result.isFinal))
                }
            }
            owned.engine.prepare()
            try owned.engine.start()
        } catch {
            let cleanup = end()
            throw cleanup ?? (error as? SpeechCaptureFailure) ?? .audioStart
        }
        #else
        throw SpeechCaptureFailure.unavailable
        #endif
    }

    public func end() -> SpeechCaptureFailure? {
        generation = UUID()
        #if canImport(Speech) && canImport(AVFoundation) && (os(iOS) || os(macOS))
        let owned = resources
        resources = nil
        if let failure = owned?.stop() {
            resources = owned // Keep ownership available for another release attempt.
            return failure
        }
        return nil
        #else
        return nil
        #endif
    }

    #if canImport(Speech) && canImport(AVFoundation) && (os(iOS) || os(macOS))
    private static func status(_ value: SFSpeechRecognizerAuthorizationStatus) -> SpeechPermissionStatus {
        switch value {
        case .authorized: return .granted
        case .notDetermined: return .undetermined
        case .denied: return .denied
        case .restricted: return .restricted
        @unknown default: return .restricted
        }
    }
    #endif
}

#if canImport(Speech) && canImport(AVFoundation) && (os(iOS) || os(macOS))
/// The audio render thread only touches request through its lock. Stop detaches
/// request before stopping the engine, so a late tap cannot append after endAudio.
private final class LocalSpeechResources: @unchecked Sendable {
    let engine = AVAudioEngine()
    let recognizer: SFSpeechRecognizer
    var task: SFSpeechRecognitionTask?
    var hasTap = false
    var ownsAudioSession = false
    private let lock = NSLock()
    private var request: SFSpeechAudioBufferRecognitionRequest?

    init(recognizer: SFSpeechRecognizer) { self.recognizer = recognizer }
    func setRequest(_ value: SFSpeechAudioBufferRecognitionRequest) { lock.withLock { request = value } }
    func append(_ buffer: AVAudioPCMBuffer) { lock.withLock { request?.append(buffer) } }

    func stop() -> SpeechCaptureFailure? {
        let old = lock.withLock { let old = request; request = nil; return old }
        engine.stop()
        if hasTap { engine.inputNode.removeTap(onBus: 0); hasTap = false }
        old?.endAudio()
        task?.cancel()
        task = nil
        engine.reset()
        #if os(iOS)
        if ownsAudioSession {
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
                ownsAudioSession = false
            }
            catch { return .audioRelease }
        }
        #endif
        return nil
    }

    deinit {
        // Explicit end reports cleanup errors. Deallocation still releases audio;
        // no recognizer/provider prose or microphone data is ever logged.
        _ = stop()
    }
}
#endif
