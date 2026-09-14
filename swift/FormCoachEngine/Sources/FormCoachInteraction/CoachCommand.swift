import Foundation

public enum CoachCommand: String, Codable, CaseIterable, Sendable {
    case pause, resume, demo, `repeat`, explain, skip, finish, end, cancel
    case confirmSkip = "confirm-skip", confirmFinish = "confirm-finish", confirmEnd = "confirm-end"
    /// Exact control grammar never invokes a language model, including urgent Pause.
    public var bypassLLM: Bool { true }
}

/// Port of HTML parseCoachCommand, verified against coach-command-vectors/1.
/// The bound is UTF-16 code units, as in JavaScript String.length. No substring
/// intent inference, fuzzy matching, model calls or transcript storage.
public func parseCoachCommand(_ input: String?, spoken: Bool = false, final: Bool = true) -> CoachCommand? {
    guard let input, input.utf16.count <= 120 else { return nil }
    // ECMAScript whitespace, intentionally not Foundation's broader whitespace set.
    let whitespace = CharacterSet(charactersIn: "\u{0009}\u{000A}\u{000B}\u{000C}\u{000D}\u{0020}\u{00A0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}")
    var text = input.lowercased().trimmingCharacters(in: whitespace)
    while let last = text.unicodeScalars.last, [33, 46, 63].contains(last.value) { text.removeLast() }
    text = text.trimmingCharacters(in: whitespace).components(separatedBy: whitespace)
        .filter { !$0.isEmpty }.joined(separator: " ")
    if spoken && !text.hasPrefix("coach ") { return nil }
    if text.hasPrefix("coach ") { text = String(text.dropFirst(6)) }
    let commands: [String: CoachCommand] = [
        "pause": .pause, "stop": .pause, "resume": .resume, "continue": .resume,
        "show me": .demo, "show me again": .demo, "show me how": .demo,
        "repeat": .repeat, "repeat that": .repeat, "why": .explain,
        "why didn't that count": .explain, "why did that not count": .explain,
        "skip": .skip, "skip this set": .skip, "finish this set": .finish, "finish check": .finish,
        "end workout": .end, "cancel": .cancel, "confirm skip": .confirmSkip,
        "confirm finish": .confirmFinish, "confirm end": .confirmEnd
    ]
    guard let action = commands[text], final || action == .pause else { return nil }
    return action
}

public struct CoachCommandContext: Equatable, Sendable {
    /// Include workout/session, navigation epoch, step, tier, following and paused.
    /// Change it on every transition, including ABA transitions back to the same set.
    public let token: String
    public var allowed: Bool
    public var otherDialogOpen: Bool
    public var calibration: Bool
    public var following: Bool
    public var coachSpeaking: Bool
    public init(token: String, allowed: Bool = true, otherDialogOpen: Bool = false,
                calibration: Bool = false, following: Bool = false, coachSpeaking: Bool = false) {
        self.token = token
        self.allowed = allowed
        self.otherDialogOpen = otherDialogOpen
        self.calibration = calibration
        self.following = following
        self.coachSpeaking = coachSpeaking
    }
}

/// Native UI is not ported. Implement these with the SAME callbacks as visible
/// controls. In particular, explain/demo/repeat pause and show help; confirmed
/// skip/finish/end perform the existing skip/finish/stop action, not new counting.
@MainActor
public protocol CoachCommandActionHost: AnyObject {
    var commandContext: CoachCommandContext? { get }
    func performCommandAction(_ action: CoachCommand) -> Bool
}

public struct CoachCommandConfirmation: Equatable, Sendable {
    public let action: CoachCommand
    public let contextToken: String
    public let expiresAt: TimeInterval
}

public enum CoachCommandRouteResult: Equatable, Sendable {
    case performed, confirmationRequired, cancelled, rejected, finishUnavailable, confirmationMismatch, confirmationExpired
}

/// Port of routeCoachAction's command/confirmation policy, outside pose judgement.
/// Share this router between speech, typed commands and confirmation controls.
@MainActor
public final class CoachCommandRouter {
    public private(set) var pending: CoachCommandConfirmation?
    public var onConfirmationChange: (@MainActor (CoachCommandConfirmation?) -> Void)?
    public var onResult: (@MainActor (CoachCommandRouteResult) -> Void)?
    private let host: any CoachCommandActionHost
    private let now: @MainActor () -> TimeInterval
    private var timer: Task<Void, Never>?

    public init(host: any CoachCommandActionHost,
                now: @escaping @MainActor () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }) {
        self.host = host
        self.now = now
    }

    public func cancelConfirmation() {
        timer?.cancel()
        timer = nil
        if pending != nil { pending = nil; onConfirmationChange?(nil) }
    }

    /// Call on host transitions and periodically; callbacks also validate time
    /// and context, so delayed timers can never authorize stale destructive work.
    public func synchronize() {
        guard let pending else { return }
        guard let current = validContext(), current.token == pending.contextToken else {
            cancelConfirmation(); return
        }
        if now() >= pending.expiresAt {
            cancelConfirmation()
            onResult?(.confirmationExpired)
        }
    }

    @discardableResult
    public func route(_ action: CoachCommand) -> CoachCommandRouteResult {
        let result = routeCurrent(action)
        onResult?(result)
        return result
    }

    private func routeCurrent(_ action: CoachCommand) -> CoachCommandRouteResult {
        guard let current = validContext() else { cancelConfirmation(); return .rejected }
        if action == .pause {
            cancelConfirmation()
            return host.performCommandAction(.pause) ? .performed : .rejected
        }
        guard !current.otherDialogOpen else { return .rejected }
        switch action {
        case .resume, .demo, .repeat, .explain:
            cancelConfirmation()
            return host.performCommandAction(action) ? .performed : .rejected
        case .cancel:
            cancelConfirmation()
            return .cancelled
        case .skip, .finish, .end:
            cancelConfirmation()
            // HTML opens its paused explanation panel before requesting consent.
            guard host.performCommandAction(.explain), let paused = validContext() else { return .rejected }
            if action == .finish, !paused.calibration, !paused.following { return .finishUnavailable }
            let item = CoachCommandConfirmation(action: action, contextToken: paused.token, expiresAt: now() + 10)
            pending = item
            onConfirmationChange?(item)
            timer = Task { [weak self] in
                while !Task.isCancelled {
                    do { try await Task.sleep(for: .milliseconds(100)) }
                    catch { return }
                    guard let self, self.pending != nil else { return }
                    self.synchronize()
                }
            }
            return .confirmationRequired
        case .confirmSkip, .confirmFinish, .confirmEnd:
            let requested: CoachCommand = action == .confirmSkip ? .skip : action == .confirmFinish ? .finish : .end
            let item = pending
            cancelConfirmation()
            guard let item, item.action == requested, item.contextToken == current.token else { return .confirmationMismatch }
            // JS's direct route rejects > expires; its scheduled UI clears at >=.
            guard now() <= item.expiresAt else { return .confirmationExpired }
            return host.performCommandAction(requested) ? .performed : .rejected
        case .pause: return .rejected // Handled above, before other dialog ownership.
        }
    }

    private func validContext() -> CoachCommandContext? {
        guard let value = host.commandContext, value.allowed, !value.token.isEmpty,
              value.token.utf16.count <= 512 else { return nil }
        return value
    }
}
