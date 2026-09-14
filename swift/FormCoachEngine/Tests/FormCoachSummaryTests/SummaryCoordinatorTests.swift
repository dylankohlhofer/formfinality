import Foundation
import XCTest
@testable import FormCoachSummary

private actor ControlledSelector: SummarySelecting {
    let state: SummaryModelAvailability
    let holdAvailability: Bool
    private(set) var availabilityCalls = 0
    private(set) var catalogs: [[WorkoutSummaryEnvelope.Card]] = []
    private var availabilityContinuation: CheckedContinuation<SummaryModelAvailability, Never>?
    private var selections: [CheckedContinuation<Data, Error>] = []

    init(state: SummaryModelAvailability = .available, holdAvailability: Bool = false) {
        self.state = state
        self.holdAvailability = holdAvailability
    }

    func availability() async -> SummaryModelAvailability {
        availabilityCalls += 1
        if holdAvailability {
            return await withCheckedContinuation { availabilityContinuation = $0 }
        }
        return state
    }

    func select(from cards: [WorkoutSummaryEnvelope.Card]) async throws -> Data {
        catalogs.append(cards)
        // Deliberately ignores cancellation until the test releases it.
        return try await withCheckedThrowingContinuation { selections.append($0) }
    }

    func releaseAvailability() {
        availabilityContinuation?.resume(returning: state)
        availabilityContinuation = nil
    }

    func releaseFirst(_ result: Result<Data, Error>) {
        guard !selections.isEmpty else { return }
        selections.removeFirst().resume(with: result)
    }
}

private enum StubError: Error { case failure }

final class SummaryCoordinatorTests: XCTestCase {
    @MainActor
    private func waitForCalls(_ count: Int, to provider: ControlledSelector, availability: Bool = false) async throws {
        let deadline = ContinuousClock.now.advanced(by: .seconds(1))
        while ContinuousClock.now < deadline {
            let actual = availability ? await provider.availabilityCalls : await provider.catalogs.count
            if actual >= count { return }
            try await Task.sleep(for: .milliseconds(1))
        }
        XCTFail("Provider did not receive \(count) calls")
    }

    private func response(_ summary: WorkoutSummaryEnvelope, index: Int = 1) throws -> Data {
        try SummaryFixture.json(["cardIds": [summary.cards[index].id]])
    }

    @MainActor
    func testDefaultDisabledAndTemplateAvailableBeforeGeneration() async throws {
        let summary = try SummaryFixture.summary()
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider)
        coordinator.show(summary)
        XCTAssertEqual(coordinator.current?.selection.cardIds, summary.defaultCardIds)
        XCTAssertEqual(coordinator.current?.status, .notRequested)
        XCTAssertNil(coordinator.current?.modelAvailability)
        let calls = await provider.availabilityCalls
        XCTAssertEqual(calls, 0, "show must not check availability or start/prewarm the model")

        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let request = Task { await coordinator.requestOnDeviceSelection(for: requestID) }
        try await waitForCalls(1, to: provider)
        XCTAssertEqual(coordinator.current?.status, .selecting)
        XCTAssertEqual(coordinator.current?.modelAvailability, .available)
        XCTAssertEqual(coordinator.current?.selection.source, .template)
        XCTAssertEqual(coordinator.current?.summary.headline, summary.headline)
        XCTAssertEqual(coordinator.current?.summary.coverage, summary.coverage)
        let catalogs = await provider.catalogs
        XCTAssertEqual(catalogs, [summary.cards], "Only the catalog crosses the model boundary")
        await provider.releaseFirst(.success(try response(summary)))
        await request.value
        XCTAssertEqual(coordinator.current?.status, .selected)
        XCTAssertEqual(coordinator.current?.selectedCards, [summary.cards[1]])
        XCTAssertEqual(coordinator.current?.summary, summary, "Selection never rewrites facts, text or coverage")
    }

    @MainActor
    func testEveryUnavailableStateKeepsTemplateWithoutGeneration() async throws {
        let summary = try SummaryFixture.summary()
        for state in SummaryModelAvailability.allCases where state != .available {
            let provider = ControlledSelector(state: state)
            let coordinator = SummaryCoordinator(provider: provider)
            coordinator.show(summary)
            let requestID = try XCTUnwrap(coordinator.current?.requestID)
            await coordinator.requestOnDeviceSelection(for: requestID)
            XCTAssertEqual(coordinator.current?.status, .unavailable(state))
            XCTAssertEqual(coordinator.current?.modelAvailability, state)
            XCTAssertEqual(coordinator.current?.selection.cardIds, summary.defaultCardIds)
            let calls = await provider.catalogs.count
            XCTAssertEqual(calls, 0)
        }
    }

    @MainActor
    func testEmptyCatalogNeverQueriesProvider() async throws {
        let summary = try WorkoutSummaryEnvelope(headline: "No work.", coverage: "No judgement.", cards: [], defaultCardIds: [])
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider)
        coordinator.show(summary)
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        await coordinator.requestOnDeviceSelection(for: requestID)
        XCTAssertEqual(coordinator.current?.status, .emptyCatalog)
        XCTAssertEqual(coordinator.current?.selectedCards, [])
        let calls = await provider.availabilityCalls
        XCTAssertEqual(calls, 0)
    }

    @MainActor
    func testInvalidSelectionAndProviderErrorsKeepTemplate() async throws {
        let summary = try SummaryFixture.summary()
        let cases: [(Result<Data, Error>, SummaryStatus, SummarySelection.Reason)] = [
            (.success(Data(#"{"cardIds":["set-1-focus"],"text":"Invented claim"}"#.utf8)), .invalidSelection, .invalidSelection),
            (.success(Data("null".utf8)), .invalidSelection, .invalidSelection),
            (.success(Data(#"{"cardIds":["set-1-focus"],}"#.utf8)), .invalidSelection, .invalidSelection),
            (.success(Data(#"{"cardIds":["set-1-focus"],"cardIds":["unknown"]}"#.utf8)), .invalidSelection, .invalidSelection),
            (.failure(StubError.failure), .providerError, .notRequested),
            (.failure(CancellationError()), .cancelled, .notRequested),
            (.failure(SummaryProviderError.unavailable(.modelNotReady)), .unavailable(.modelNotReady), .notRequested)
        ]
        for (result, status, reason) in cases {
            let provider = ControlledSelector()
            let coordinator = SummaryCoordinator(provider: provider)
            coordinator.show(summary)
            let requestID = try XCTUnwrap(coordinator.current?.requestID)
            let request = Task { await coordinator.requestOnDeviceSelection(for: requestID) }
            try await waitForCalls(1, to: provider)
            await provider.releaseFirst(result)
            await request.value
            XCTAssertEqual(coordinator.current?.status, status)
            XCTAssertEqual(coordinator.current?.selection.reason, reason)
            XCTAssertEqual(coordinator.current?.selection.cardIds, summary.defaultCardIds)
            XCTAssertEqual(coordinator.current?.summary, summary)
        }
    }

    @MainActor
    func testTimeoutReturnsWhileGenerationIgnoresCancellationAndRejectsLateResult() async throws {
        let summary = try SummaryFixture.summary()
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider, timeout: .milliseconds(60))
        coordinator.show(summary)
        let returned = expectation(description: "Timeout returns without joining the suspended provider")
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let request = Task { await coordinator.requestOnDeviceSelection(for: requestID); returned.fulfill() }
        try await waitForCalls(1, to: provider)
        await fulfillment(of: [returned], timeout: 1)
        XCTAssertEqual(coordinator.current?.status, .timedOut)
        XCTAssertEqual(coordinator.current?.modelAvailability, .available)
        let snapshot = coordinator.current
        await provider.releaseFirst(.success(try response(summary)))
        await request.value
        try await Task.sleep(for: .milliseconds(10))
        XCTAssertEqual(coordinator.current, snapshot, "Late generation must not overwrite the timed-out template")
    }

    @MainActor
    func testTimeoutAlsoBoundsAvailabilityAndPreventsLateGeneration() async throws {
        let summary = try SummaryFixture.summary()
        let provider = ControlledSelector(holdAvailability: true)
        let coordinator = SummaryCoordinator(provider: provider, timeout: .milliseconds(60))
        coordinator.show(summary)
        let returned = expectation(description: "Availability is inside the timeout")
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let request = Task { await coordinator.requestOnDeviceSelection(for: requestID); returned.fulfill() }
        try await waitForCalls(1, to: provider, availability: true)
        await fulfillment(of: [returned], timeout: 1)
        XCTAssertEqual(coordinator.current?.status, .timedOut)
        XCTAssertNil(coordinator.current?.modelAvailability, "A timed-out check has not established availability")
        await provider.releaseAvailability()
        await request.value
        try await Task.sleep(for: .milliseconds(10))
        let calls = await provider.catalogs.count
        XCTAssertEqual(calls, 0, "Late availability cannot start cancelled generation")
    }

    @MainActor
    func testCallerCancellationAndExplicitCancelReturnWithoutJoiningProvider() async throws {
        let summary = try SummaryFixture.summary()
        for cancelCaller in [true, false] {
            let provider = ControlledSelector()
            let coordinator = SummaryCoordinator(provider: provider)
            coordinator.show(summary)
            let returned = expectation(description: "Cancellation returns promptly")
            let requestID = try XCTUnwrap(coordinator.current?.requestID)
            let request = Task { await coordinator.requestOnDeviceSelection(for: requestID); returned.fulfill() }
            try await waitForCalls(1, to: provider)
            if cancelCaller { request.cancel() } else { coordinator.cancelSelection() }
            await fulfillment(of: [returned], timeout: 1)
            XCTAssertEqual(coordinator.current?.status, .cancelled)
            let snapshot = coordinator.current
            await provider.releaseFirst(.success(try response(summary)))
            await request.value
            try await Task.sleep(for: .milliseconds(10))
            XCTAssertEqual(coordinator.current, snapshot)
        }
    }

    @MainActor
    func testAlreadyCancelledRequestDoesNotQueryProvider() async throws {
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider)
        coordinator.show(try SummaryFixture.summary())
        let template = coordinator.current
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let request = Task { await coordinator.requestOnDeviceSelection(for: requestID) }
        request.cancel() // Still on MainActor: request cannot have started yet.
        await request.value
        XCTAssertEqual(coordinator.current, template, "Already cancelled callers cannot mutate even the request ID")
        let calls = await provider.availabilityCalls
        XCTAssertEqual(calls, 0)
    }

    @MainActor
    func testCancelledQueuedCallerCannotMutateNewerSummary() async throws {
        let summary = try SummaryFixture.summary()
        let replacement = try WorkoutSummaryEnvelope(headline: "Newer summary B.", coverage: summary.coverage,
                                                     cards: summary.cards, defaultCardIds: [summary.cards[0].id])
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider)
        coordinator.show(summary)
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let queuedA = Task { await coordinator.requestOnDeviceSelection(for: requestID) }
        queuedA.cancel()
        coordinator.show(replacement) // A has not entered requestOnDeviceSelection yet.
        let newerB = coordinator.current
        await queuedA.value
        XCTAssertEqual(coordinator.current, newerB)
        let calls = await provider.availabilityCalls
        XCTAssertEqual(calls, 0)
    }

    @MainActor
    func testAlreadyCancelledCallerCannotCancelAnActiveNewerRequest() async throws {
        let summary = try SummaryFixture.summary()
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider)
        coordinator.show(summary)
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let activeB = Task { await coordinator.requestOnDeviceSelection(for: requestID) }
        try await waitForCalls(1, to: provider)
        let pendingB = coordinator.current
        let pendingID = try XCTUnwrap(pendingB?.requestID)
        let cancelledA = Task { await coordinator.requestOnDeviceSelection(for: pendingID) }
        cancelledA.cancel()
        await cancelledA.value
        XCTAssertEqual(coordinator.current, pendingB, "Cancelled entry cannot cancel B's pending worker")
        await provider.releaseFirst(.success(try response(summary)))
        await activeB.value
        XCTAssertEqual(coordinator.current?.status, .selected)
        XCTAssertEqual(coordinator.current?.requestID, pendingB?.requestID)
        let calls = await provider.availabilityCalls
        XCTAssertEqual(calls, 1)
    }

    @MainActor
    func testNavigationInvalidatesAndLateOutputCannotReopenDebrief() async throws {
        let summary = try SummaryFixture.summary()
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider)
        coordinator.show(summary)
        let returned = expectation(description: "Invalidation releases caller")
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let request = Task { await coordinator.requestOnDeviceSelection(for: requestID); returned.fulfill() }
        try await waitForCalls(1, to: provider)
        coordinator.invalidate()
        await fulfillment(of: [returned], timeout: 1)
        XCTAssertNil(coordinator.current)
        await provider.releaseFirst(.success(try response(summary)))
        await request.value
        try await Task.sleep(for: .milliseconds(10))
        XCTAssertNil(coordinator.current)
        await coordinator.requestOnDeviceSelection(for: requestID)
        let calls = await provider.catalogs.count
        XCTAssertEqual(calls, 1, "An absent debrief cannot request AI")
    }

    @MainActor
    func testNewSummaryRejectsOldOutputEvenWithSameCatalogIDs() async throws {
        let summary = try SummaryFixture.summary()
        let replacement = try WorkoutSummaryEnvelope(headline: "A different session.", coverage: summary.coverage,
                                                     cards: summary.cards, defaultCardIds: [summary.cards[0].id])
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider)
        coordinator.show(summary)
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let request = Task { await coordinator.requestOnDeviceSelection(for: requestID) }
        try await waitForCalls(1, to: provider)
        let oldID = coordinator.current?.requestID
        coordinator.show(replacement)
        let expected = coordinator.current
        XCTAssertNotEqual(expected?.requestID, oldID)
        await provider.releaseFirst(.success(try response(summary)))
        await request.value
        try await Task.sleep(for: .milliseconds(10))
        XCTAssertEqual(coordinator.current, expected)
        XCTAssertEqual(coordinator.current?.status, .notRequested, "Explicit opt-in never carries into a new session")
    }

    @MainActor
    func testNewRequestSurvivesOldCompletionAndOldCallerCancellation() async throws {
        let summary = try SummaryFixture.summary()
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider)
        coordinator.show(summary)
        let firstID = try XCTUnwrap(coordinator.current?.requestID)
        let first = Task { await coordinator.requestOnDeviceSelection(for: firstID) }
        try await waitForCalls(1, to: provider)
        let oldID = coordinator.current?.requestID
        let secondID = try XCTUnwrap(coordinator.current?.requestID)
        let second = Task { await coordinator.requestOnDeviceSelection(for: secondID) }
        try await waitForCalls(2, to: provider)
        let newID = coordinator.current?.requestID
        XCTAssertNotEqual(oldID, newID)
        first.cancel()
        await provider.releaseFirst(.success(try response(summary, index: 0)))
        await first.value
        try await Task.sleep(for: .milliseconds(10))
        XCTAssertEqual(coordinator.current?.requestID, newID)
        XCTAssertEqual(coordinator.current?.status, .selecting)
        await provider.releaseFirst(.success(try response(summary, index: 1)))
        await second.value
        XCTAssertEqual(coordinator.current?.status, .selected)
        XCTAssertEqual(coordinator.current?.selectedCards, [summary.cards[1]])
    }

    @MainActor
    func testUncancelledQueuedCallerCannotOptInNewerSummary() async throws {
        let summary = try SummaryFixture.summary()
        let replacement = try WorkoutSummaryEnvelope(headline: "Newer summary B.", coverage: summary.coverage,
                                                     cards: summary.cards, defaultCardIds: [summary.cards[0].id])
        let provider = ControlledSelector()
        let coordinator = SummaryCoordinator(provider: provider)
        coordinator.show(summary)
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let queuedA = Task { await coordinator.requestOnDeviceSelection(for: requestID) }
        coordinator.show(replacement) // A is queued and has NOT been cancelled.
        let newerB = coordinator.current
        XCTAssertFalse(queuedA.isCancelled)
        await queuedA.value
        XCTAssertEqual(coordinator.current, newerB, "A's opt-in is not permission to run the model for B")
        let calls = await provider.availabilityCalls
        XCTAssertEqual(calls, 0)
    }

    @MainActor
    func testTimeoutConfigurationAlwaysBounded() {
        XCTAssertEqual(SummaryCoordinator().timeout, .seconds(10))
        XCTAssertEqual(SummaryCoordinator(timeout: .seconds(-1)).timeout, .milliseconds(1))
        XCTAssertEqual(SummaryCoordinator(timeout: .seconds(300)).timeout, .seconds(30))
    }
}
