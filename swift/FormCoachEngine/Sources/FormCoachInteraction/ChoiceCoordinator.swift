import Foundation

public enum ChoiceStatus: Equatable, Sendable {
    case notRequested, selecting, selected, noOptions, invalidSelection
    case unavailable(ChoiceModelAvailability)
    case timedOut, cancelled, providerError
}

public struct ChoiceSnapshot: Equatable, Sendable {
    /// Native lifecycle identity, distinct from the immutable wire requestId.
    /// New show/request always gets a new identity, even with repeated wire IDs.
    public let requestID: UUID
    public let request: CoachChoiceRequest
    public let selection: CoachChoiceSelection
    public let status: ChoiceStatus
    public let modelAvailability: ChoiceModelAvailability?
    public var selectedOptions: [CoachChoiceRequest.Option] {
        selection.choiceIds.compactMap { request.option(id: $0) }
    }
}

/// Adapted from SummaryCoordinator. `show` immediately installs deterministic
/// choices and does not check availability or run AI. Capture current.requestID
/// at the explicit user request BEFORE scheduling an async task. After awaiting,
/// render current, never a cached result. Invalidate when context/constraints or
/// navigation change. This component selects display options; it executes nothing.
@MainActor
public final class ChoiceCoordinator {
    public private(set) var current: ChoiceSnapshot?
    public let timeout: Duration
    private let provider: any ChoiceSelecting
    private var pending: Pending?

    /// Ten seconds maximum, including availability and generation. Shorter
    /// deadlines allow deterministic lifecycle testing; no caller can extend it.
    public init(provider: any ChoiceSelecting = FoundationModelsChoiceSelector(),
                timeout: Duration = .seconds(10)) {
        self.provider = provider
        self.timeout = min(max(timeout, .milliseconds(1)), .seconds(10))
    }

    public func show(_ request: CoachChoiceRequest) {
        cancelSelection()
        current = ChoiceSnapshot(requestID: UUID(), request: request,
            selection: selectCoachChoices(request), status: request.options.isEmpty ? .noOptions : .notRequested,
            modelAvailability: nil)
    }

    public func invalidate() {
        cancelSelection()
        current = nil
    }

    /// Prompt return even if a provider ignores cancellation. Such a provider
    /// may consume resources until it returns, but cannot publish an old result.
    public func cancelSelection() {
        if let pending { finish(id: pending.id, outcome: .status(.cancelled)) }
    }

    public func requestOnDeviceSelection(for expectedRequestID: UUID) async {
        guard !Task.isCancelled, current?.requestID == expectedRequestID,
              let request = current?.request else { return }
        cancelSelection()
        let id = UUID()
        let cancellation = ChoiceRequestCancellation()
        current = ChoiceSnapshot(requestID: id, request: request,
            selection: selectCoachChoices(request), status: request.options.isEmpty ? .noOptions : .selecting,
            modelAvailability: nil)
        guard !request.options.isEmpty else { return }
        let context = CoachChoiceContext(request: request)
        let deadline = ContinuousClock.now.advanced(by: timeout)
        await withTaskCancellationHandler {
            await withCheckedContinuation { continuation in
                pending = Pending(id: id, deadline: deadline, cancellation: cancellation,
                                  continuation: continuation)
                if Task.isCancelled || cancellation.isCancelled {
                    finish(id: id, outcome: .status(.cancelled))
                    return
                }
                let provider = self.provider
                // No task-group join: cancellation/timeout must not await a
                // provider that ignores cancellation. All publishing is guarded.
                pending?.worker = Task.detached { [weak self] in
                    let availability = await provider.availability()
                    guard !Task.isCancelled else { return }
                    guard await self?.recordAvailability(id: id, availability: availability) == true else { return }
                    let outcome: Outcome
                    if availability != .available {
                        outcome = .status(.unavailable(availability))
                    } else {
                        do {
                            try Task.checkCancellation()
                            let data = try await provider.select(from: context)
                            outcome = .selection(selectCoachChoices(request, selection: data))
                        } catch is CancellationError {
                            outcome = .status(.cancelled)
                        } catch ChoiceProviderError.unavailable(let state) {
                            outcome = .status(.unavailable(state))
                        } catch {
                            // Stable status only, never error prose or a transcript.
                            outcome = .status(.providerError)
                        }
                    }
                    await self?.finish(id: id, outcome: outcome)
                }
                pending?.timer = Task.detached { [weak self] in
                    do { try await ContinuousClock().sleep(until: deadline) }
                    catch { return } // Normal timer cancellation after completion.
                    await self?.finish(id: id, outcome: .status(.timedOut))
                }
            }
        } onCancel: { [weak self] in
            // Synchronous flag prevents an already-queued result beating the
            // MainActor cancellation cleanup task.
            cancellation.cancel()
            Task { @MainActor in self?.finish(id: id, outcome: .status(.cancelled)) }
        }
    }

    private enum Outcome: Sendable {
        case selection(CoachChoiceSelection), status(ChoiceStatus)
    }
    private struct Pending {
        let id: UUID
        let deadline: ContinuousClock.Instant
        let cancellation: ChoiceRequestCancellation
        let continuation: CheckedContinuation<Void, Never>
        var worker: Task<Void, Never>?
        var timer: Task<Void, Never>?
    }

    private func recordAvailability(id: UUID, availability: ChoiceModelAvailability) -> Bool {
        guard let active = pending, active.id == id, let snapshot = current,
              snapshot.requestID == id else { return false }
        if active.cancellation.isCancelled {
            finish(id: id, outcome: .status(.cancelled))
            return false
        }
        if ContinuousClock.now >= active.deadline {
            finish(id: id, outcome: .status(.timedOut))
            return false
        }
        current = ChoiceSnapshot(requestID: id, request: snapshot.request,
            selection: snapshot.selection, status: snapshot.status, modelAvailability: availability)
        return true
    }

    private func finish(id: UUID, outcome: Outcome) {
        guard let active = pending, active.id == id, let snapshot = current,
              snapshot.requestID == id else { return }
        pending = nil
        active.worker?.cancel()
        active.timer?.cancel()
        var selection = selectCoachChoices(snapshot.request)
        let status: ChoiceStatus
        if active.cancellation.isCancelled {
            status = .cancelled
        } else if case .status(.cancelled) = outcome {
            status = .cancelled
        } else if ContinuousClock.now >= active.deadline {
            status = .timedOut
        } else {
            switch outcome {
            case .selection(let result):
                if result.source == .onDevice {
                    selection = result
                    status = .selected
                } else {
                    // Provider was requested: even null is invalid output here.
                    selection = CoachChoiceSelection(choiceIds: snapshot.request.defaultIds,
                        source: .template, reason: .invalidSelection)
                    status = .invalidSelection
                }
            case .status(let reason): status = reason
            }
        }
        current = ChoiceSnapshot(requestID: id, request: snapshot.request, selection: selection,
            status: status, modelAvailability: snapshot.modelAvailability)
        active.continuation.resume()
    }
}

private final class ChoiceRequestCancellation: @unchecked Sendable {
    private let lock = NSLock()
    private var cancelled = false
    var isCancelled: Bool { lock.withLock { cancelled } }
    func cancel() { lock.withLock { cancelled = true } }
}
