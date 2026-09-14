import Foundation

public enum SpeechPermission: Sendable { case microphone, recognition }
public enum SpeechPermissionStatus: Sendable { case undetermined, granted, denied, restricted }
public enum SpeechAvailability: Equatable, Sendable {
    case available, frameworkUnavailable, localeUnsupported, onDeviceUnavailable, temporarilyUnavailable
}
public enum SpeechCaptureFailure: Error, Equatable, Sendable {
    case permissionDenied, permissionTimeout, unavailable, audioStart, audioRelease, recognition, transcriptLimit, expired
}
public enum SpeechCaptureEvent: Sendable {
    case transcript(String, isFinal: Bool)
    case failure(SpeechCaptureFailure)
}

/// Production implementations MUST require local recognition before capturing audio.
/// Neither initialization nor availability/permission inspection may prompt or record.
/// Callbacks and ownership are serialized on MainActor. A stop invalidates callbacks.
@MainActor
public protocol SpeechCapturing: AnyObject {
    var availability: SpeechAvailability { get }
    func permission(_ kind: SpeechPermission) -> SpeechPermissionStatus
    func requestPermission(_ kind: SpeechPermission,
                           completion: @escaping @MainActor (SpeechPermissionStatus) -> Void)
    func begin(maximumTranscriptBytes: Int,
               receive: @escaping @MainActor (SpeechCaptureEvent) -> Void) throws
    /// Idempotent; release the input tap, engine, request, task and owned audio session.
    func end() -> SpeechCaptureFailure?
}

public enum SpeechListeningState: Equatable, Sendable {
    case disabled, requestingPermission, listening, coachSpeaking, echoGrace, background
    case unavailable(SpeechAvailability), failed(SpeechCaptureFailure), expired
}

/// Native transport lifecycle only. It does not decide or execute workout commands.
/// The host supplies JS-contract bounds/timing and routes transcripts synchronously
/// to its command policy. This component retains no transcript, log or history.
@MainActor
public final class SpeechCaptureCoordinator {
    public private(set) var state: SpeechListeningState = .disabled
    public var onStateChange: (@MainActor (SpeechListeningState) -> Void)?
    public var onTranscript: (@MainActor (String, Bool) -> Void)?
    /// Changes on every fresh recognition task; partial/final duplicate guards
    /// must key on this identity, never on recognized text.
    public private(set) var requestID = UUID()
    public var isEnabled: Bool { enabled }
    private let capture: any SpeechCapturing
    private let maximumTranscriptBytes: Int
    private let captureLifetime: TimeInterval
    private let echoGrace: TimeInterval
    private let now: @MainActor () -> TimeInterval
    private var generation = UUID()
    private var enabled = false
    private var foreground = true
    private var speaking = false
    private var graceUntil: TimeInterval = 0
    private var deadline: TimeInterval = 0
    private var permissionDeadline: TimeInterval = 0
    private var authorizing = false
    private var authorizationStep = UUID()
    private var releaseFailure: SpeechCaptureFailure?
    private var timer: Task<Void, Never>?

    public init(capture: any SpeechCapturing, maximumTranscriptBytes: Int,
                captureLifetime: TimeInterval, echoGrace: TimeInterval,
                now: @escaping @MainActor () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }) {
        precondition((1...4096).contains(maximumTranscriptBytes))
        precondition(captureLifetime.isFinite && captureLifetime > 0 && captureLifetime <= 60)
        precondition(echoGrace.isFinite && echoGrace >= 0 && echoGrace <= 30)
        self.capture = capture
        self.maximumTranscriptBytes = maximumTranscriptBytes
        self.captureLifetime = captureLifetime
        self.echoGrace = echoGrace
        self.now = now
    }

    /// Call only from an explicit user Start listening action. No automatic opt-in.
    public func startFromUserAction() {
        guard foreground else { return }
        guard release() else { return }
        enabled = true
        let id = generation
        guard capture.availability == .available else {
            enabled = false
            publish(.unavailable(capture.availability))
            return
        }
        if speaking { publish(.coachSpeaking); return }
        if now() < graceUntil { publish(.echoGrace); scheduleTick(); return }
        beginAuthorization(id: id)
    }

    public func disable() {
        enabled = false
        if release() { publish(.disabled) }
    }

    /// Reset also discards opt-in; a new context requires explicit Start listening.
    public func reset() { disable() }

    public func setForeground(_ value: Bool) {
        foreground = value
        if !value {
            enabled = false
            if release() { publish(.background) }
        }
        // Foreground return deliberately never reacquires the microphone.
    }

    /// Call BEFORE starting coach audio, including clips, TTS and confirmation audio.
    /// Release capture during speech, then start a fresh request after the grace.
    public func setCoachSpeaking(_ value: Bool) {
        guard speaking != value else { return }
        speaking = value
        if value {
            guard release() else { return }
            if enabled { publish(.coachSpeaking) }
        } else {
            graceUntil = now() + echoGrace
            if enabled { publish(.echoGrace); scheduleTick() }
        }
    }

    /// A monotonic-clock seam lets tests exercise expiry without microphone or sleeps.
    public func tick() {
        guard enabled, foreground else { return }
        if state == .echoGrace, !speaking, now() >= graceUntil {
            beginAuthorization(id: generation)
        } else if authorizing, now() >= permissionDeadline {
            fail(.permissionTimeout)
        } else if state == .listening, now() >= deadline {
            if release() {
                graceUntil = now() + echoGrace
                publish(.echoGrace)
                scheduleTick()
            }
        }
    }

    /// Context changes discard old audio while retaining this workout's opt-in.
    /// Unlike reset/disable, this permits fresh capture after the quiet interval.
    public func invalidateContext() {
        guard enabled, release() else { return }
        graceUntil = now() + echoGrace
        publish(speaking ? .coachSpeaking : .echoGrace)
        scheduleTick()
    }

    private func beginAuthorization(id: UUID) {
        guard enabled, foreground, generation == id else { return }
        permissionDeadline = now() + 10
        authorizing = true
        publish(.requestingPermission)
        scheduleTick()
        authorize(.microphone, id: id) { [weak self] in
            self?.authorize(.recognition, id: id) { [weak self] in
                self?.authorizing = false
                self?.listen(id: id)
            }
        }
    }

    private func authorize(_ kind: SpeechPermission, id: UUID, next: @escaping @MainActor () -> Void) {
        guard enabled, foreground, generation == id else { return }
        guard now() < permissionDeadline else { fail(.permissionTimeout); return }
        switch capture.permission(kind) {
        case .granted: next()
        case .denied, .restricted: fail(.permissionDenied)
        case .undetermined:
            let step = UUID()
            authorizationStep = step
            capture.requestPermission(kind) { [weak self] status in
                guard let self, self.enabled, self.foreground, self.generation == id,
                      self.authorizationStep == step else { return }
                self.authorizationStep = UUID()
                guard self.now() < self.permissionDeadline else { self.fail(.permissionTimeout); return }
                guard status == .granted else { self.fail(.permissionDenied); return }
                next()
            }
        }
    }

    private func listen(id: UUID) {
        guard enabled, foreground, id == generation else { return }
        guard !speaking else { publish(.coachSpeaking); return }
        guard now() >= graceUntil else { publish(.echoGrace); scheduleTick(); return }
        guard capture.permission(.microphone) == .granted, capture.permission(.recognition) == .granted else {
            fail(.permissionDenied); return
        }
        guard capture.availability == .available else {
            enabled = false
            if release() { publish(.unavailable(capture.availability)) }
            return
        }
        deadline = now() + captureLifetime
        requestID = UUID()
        do {
            try capture.begin(maximumTranscriptBytes: maximumTranscriptBytes) { [weak self] event in
                guard let self, self.generation == id, self.enabled, self.foreground,
                      !self.speaking, self.now() >= self.graceUntil else { return }
                guard self.now() < self.deadline else { self.tick(); return }
                switch event {
                case .failure(let failure): self.fail(failure)
                case .transcript(let text, let isFinal):
                    guard text.utf8.count <= self.maximumTranscriptBytes else { self.fail(.transcriptLimit); return }
                    // A final result closes one request, not the user's opt-in.
                    // Keep its requestID through delivery for partial/final dedupe.
                    if isFinal {
                        guard self.release() else { return }
                        self.graceUntil = self.now() + self.echoGrace
                        let deliveryGeneration = self.generation
                        self.publish(.echoGrace)
                        guard self.enabled, self.foreground, !self.speaking,
                              self.generation == deliveryGeneration else { return }
                    }
                    self.onTranscript?(text, isFinal)
                    if isFinal, self.enabled { self.scheduleTick() }
                }
            }
            guard enabled, id == generation else { return }
            publish(.listening)
            scheduleTick()
        } catch {
            fail((error as? SpeechCaptureFailure) ?? .audioStart)
        }
    }

    @discardableResult
    private func release() -> Bool {
        generation = UUID()
        authorizing = false
        timer?.cancel()
        timer = nil
        let cleanup = capture.end()
        if let failure = releaseFailure ?? cleanup {
            releaseFailure = failure
            enabled = false
            publish(.failed(failure))
            return false
        }
        return true
    }

    private func fail(_ failure: SpeechCaptureFailure) {
        enabled = false
        if release() { publish(.failed(failure)) }
    }

    private func publish(_ value: SpeechListeningState) {
        state = value
        onStateChange?(value)
    }

    private func scheduleTick() {
        timer?.cancel()
        let id = generation
        timer = Task { [weak self] in
            while !Task.isCancelled {
                do { try await Task.sleep(for: .milliseconds(50)) }
                catch { return } // Explicit timer cancellation is expected.
                guard let self, self.generation == id, self.enabled else { return }
                self.tick()
            }
        }
    }
}
