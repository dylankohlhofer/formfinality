import Foundation

/// Native lifecycle/availability is separate from the three JS selection reasons.
/// Errors expose a stable code, never provider prose, prompts or transcripts.
public enum SummaryStatus: Equatable, Sendable {
    case notRequested, selecting, selected, emptyCatalog, invalidSelection
    case unavailable(SummaryModelAvailability)
    case timedOut, cancelled, providerError
}

public struct SummarySnapshot: Equatable, Sendable {
    public let requestID: UUID
    public let summary: WorkoutSummaryEnvelope
    public let selection: SummarySelection
    public let status: SummaryStatus
    /// nil until a bounded availability check completes. Never inferred from an
    /// error or timeout; a model can become unavailable after an available check.
    public let modelAvailability: SummaryModelAvailability?
    public var selectedCards: [WorkoutSummaryEnvelope.Card] {
        selection.cardIds.compactMap { summary.card(id: $0) }
    }
}

/// A debrief integration component, independent of SessionCore and any UI.
/// `show` synchronously installs a usable template and NEVER starts a model.
/// Only an explicit `requestOnDeviceSelection` enables generation for this request.
/// Read `current` after awaiting; do not cache a result across navigation. Call
/// `invalidate` when leaving the debrief. A new show/request invalidates old work.
@MainActor
public final class SummaryCoordinator {
    public private(set) var current: SummarySnapshot?
    public let timeout: Duration
    private let provider: any SummarySelecting
    private var pending: Pending?

    /// Timeout covers availability AND generation, clamped to 1ms...30s.
    public init(provider: any SummarySelecting = FoundationModelsSummarySelector(),
                timeout: Duration = .seconds(10)) {
        self.provider = provider
        self.timeout = min(max(timeout, .milliseconds(1)), .seconds(30))
    }

    public func show(_ summary: WorkoutSummaryEnvelope) {
        cancelSelection()
        current = SummarySnapshot(requestID: UUID(), summary: summary,
                                  selection: selectSummaryCards(summary), status: .notRequested,
                                  modelAvailability: nil)
    }

    public func invalidate() {
        cancelSelection()
        current = nil
    }

    /// Keep the usable template and return promptly, even for a provider that
    /// ignores cancellation. The abandoned provider may still consume resources;
    /// Swift cancellation cannot forcibly terminate it, but it cannot publish.
    public func cancelSelection() {
        if let pending { finish(id: pending.id, outcome: .status(.cancelled)) }
    }

    /// Capture current.requestID at the user's request, BEFORE creating a Task.
    /// This binds opt-in to that snapshot even if an uncancelled UI task runs late.
    public func requestOnDeviceSelection(for expectedRequestID: UUID) async {
        guard !Task.isCancelled, current?.requestID == expectedRequestID else { return }
        guard let summary = current?.summary else { return }
        cancelSelection()
        let id = UUID()
        let cancellation = RequestCancellation()
        current = SummarySnapshot(requestID: id, summary: summary,
                                  selection: selectSummaryCards(summary), status: .selecting,
                                  modelAvailability: nil)
        if summary.cards.isEmpty {
            current = SummarySnapshot(requestID: id, summary: summary,
                                      selection: selectSummaryCards(summary), status: .emptyCatalog,
                                      modelAvailability: nil)
            return
        }
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
                // Unstructured tasks intentionally avoid a task group's implicit
                // join, which would hang the timeout on ignored cancellation.
                pending?.worker = Task.detached { [weak self] in
                    let availability = await provider.availability()
                    guard !Task.isCancelled else { return }
                    guard await self?.recordAvailability(id: id, availability: availability) == true else { return }
                    let outcome: Outcome
                    if availability != .available {
                        outcome = .status(.unavailable(availability))
                    } else {
                        do {
                            let data = try await provider.select(from: summary.cards)
                            outcome = .selection(selectSummaryCards(summary, selection: data))
                        } catch is CancellationError {
                            outcome = .status(.cancelled)
                        } catch SummaryProviderError.unavailable(let state) {
                            outcome = .status(.unavailable(state))
                        } catch {
                            outcome = .status(.providerError)
                        }
                    }
                    await self?.finish(id: id, outcome: outcome)
                }
                pending?.timer = Task.detached { [weak self] in
                    do {
                        try await ContinuousClock().sleep(until: deadline)
                    } catch { return } // Timer was explicitly cancelled by completion.
                    await self?.finish(id: id, outcome: .status(.timedOut))
                }
            }
        } onCancel: { [weak self] in
            // Set synchronously so a result already enqueued on MainActor cannot
            // beat cancellation merely because this cleanup Task runs later.
            cancellation.cancel()
            Task { @MainActor in self?.finish(id: id, outcome: .status(.cancelled)) }
        }
    }

    private enum Outcome: Sendable {
        case selection(SummarySelection), status(SummaryStatus)
    }

    private struct Pending {
        let id: UUID
        let deadline: ContinuousClock.Instant
        let cancellation: RequestCancellation
        let continuation: CheckedContinuation<Void, Never>
        var worker: Task<Void, Never>?
        var timer: Task<Void, Never>?
    }

    private func recordAvailability(id: UUID, availability: SummaryModelAvailability) -> Bool {
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
        current = SummarySnapshot(requestID: id, summary: snapshot.summary,
                                  selection: snapshot.selection, status: snapshot.status,
                                  modelAvailability: availability)
        return true
    }

    private func finish(id: UUID, outcome: Outcome) {
        guard let active = pending, active.id == id, let snapshot = current,
              snapshot.requestID == id else { return }
        pending = nil
        active.worker?.cancel()
        active.timer?.cancel()
        var selection = selectSummaryCards(snapshot.summary)
        let status: SummaryStatus
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
                    // The pure JS helper treats null as "not requested". Here a
                    // provider WAS requested: even JSON null is a rejected reply.
                    selection = SummarySelection(source: .template, reason: .invalidSelection,
                                                 cardIds: snapshot.summary.defaultCardIds)
                    status = .invalidSelection
                }
            case .status(let reason): status = reason
            }
        }
        current = SummarySnapshot(requestID: id, summary: snapshot.summary,
                                  selection: selection, status: status,
                                  modelAvailability: snapshot.modelAvailability)
        active.continuation.resume()
    }
}

/// The only cross-actor mutable flag; every access is protected by the lock.
private final class RequestCancellation: @unchecked Sendable {
    private let lock = NSLock()
    private var cancelled = false
    var isCancelled: Bool { lock.withLock { cancelled } }
    func cancel() { lock.withLock { cancelled = true } }
}
