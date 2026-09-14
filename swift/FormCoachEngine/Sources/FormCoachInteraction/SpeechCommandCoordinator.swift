import Foundation

/// Joins the local microphone transport to the HTML-first exact command router.
/// No model dependency; Pause reaches the host synchronously on MainActor.
@MainActor
public final class SpeechCommandCoordinator {
    public let speech: SpeechCaptureCoordinator
    public let commands: CoachCommandRouter
    private let host: any CoachCommandActionHost
    private var contextToken: String?
    private var consumedRequest: UUID?

    public init(capture: any SpeechCapturing, host: any CoachCommandActionHost,
                captureLifetime: TimeInterval = 55,
                now: @escaping @MainActor () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }) {
        self.host = host
        self.commands = CoachCommandRouter(host: host, now: now)
        // 120 UTF-16 units (parser) fit within 480 UTF-8 bytes (transport cap).
        self.speech = SpeechCaptureCoordinator(capture: capture, maximumTranscriptBytes: 480,
                                               captureLifetime: captureLifetime, echoGrace: 0.750, now: now)
        speech.onTranscript = { [weak self] text, final in self?.receive(text, final: final) }
    }

    public func startFromUserAction() {
        synchronize()
        guard contextToken != nil else { return }
        speech.startFromUserAction()
    }

    public func disable() { speech.disable(); commands.cancelConfirmation(); consumedRequest = nil }
    public func reset() { disable(); contextToken = nil }
    public func setForeground(_ value: Bool) {
        speech.setForeground(value)
        if !value { commands.cancelConfirmation(); consumedRequest = nil }
    }

    /// Call synchronously BEFORE coach audio or on host/context/dialog changes.
    /// The result path repeats this check, including races before a host tick.
    public func synchronize() {
        commands.synchronize()
        guard let context = host.commandContext, context.allowed, !context.token.isEmpty,
              context.token.utf16.count <= 512 else {
            contextToken = nil
            disable()
            return
        }
        if context.token != contextToken {
            contextToken = context.token
            consumedRequest = nil
            speech.invalidateContext()
        }
        speech.setCoachSpeaking(context.coachSpeaking)
    }

    private func receive(_ text: String, final: Bool) {
        let originalContext = contextToken
        synchronize()
        guard contextToken != nil, originalContext == contextToken, speech.isEnabled,
              host.commandContext?.coachSpeaking == false else { return }
        let request = speech.requestID
        guard consumedRequest != request else { return }
        let action = parseCoachCommand(text, spoken: true, final: final)
        if final || action != nil { consumedRequest = request }
        if let action {
            commands.route(action)
            synchronize()
        }
    }
}
