import Foundation
import XCTest
import FormCoachSummary

final class LocalModelSmokeTests: XCTestCase {
    /// Opt-in only: FORM_COACH_LOCAL_MODEL_SMOKE=1 swift test --filter LocalModelSmokeTests
    /// Synthetic shared cards only. Output is availability/status/IDs; no transcripts,
    /// generated prose, uploads, persistence, or framework feedback attachments.
    @MainActor
    func testActualSystemModelWithSharedSyntheticCards() async throws {
        guard ProcessInfo.processInfo.environment["FORM_COACH_LOCAL_MODEL_SMOKE"] == "1" else {
            throw XCTSkip("Actual local model smoke disabled; set FORM_COACH_LOCAL_MODEL_SMOKE=1 explicitly.")
        }
        let summary = try SummaryFixture.summary()
        let coordinator = SummaryCoordinator() // Exercise the production deadline.
        coordinator.show(summary)
        let requestID = try XCTUnwrap(coordinator.current?.requestID)
        let started = ContinuousClock.now
        await coordinator.requestOnDeviceSelection(for: requestID)
        let snapshot = try XCTUnwrap(coordinator.current)
        print("LOCAL MODEL SMOKE: availability=\(snapshot.modelAvailability?.rawValue ?? "check-did-not-complete"); " +
              "status=\(snapshot.status); source=\(snapshot.selection.source.rawValue); " +
              "reason=\(snapshot.selection.reason.rawValue); cardIds=\(snapshot.selection.cardIds); " +
              "elapsed=\(started.duration(to: .now)); synthetic=true; upload=false")
        guard snapshot.status == .selected else {
            XCTAssertEqual(snapshot.selection.source, .template)
            XCTAssertEqual(snapshot.selection.cardIds, summary.defaultCardIds)
            if case .unavailable(let reason) = snapshot.status {
                throw XCTSkip("COVERAGE GAP: actual local model unavailable; reason=\(reason.rawValue)")
            }
            XCTFail("Actual local model smoke failed: \(snapshot.status). Template fallback is usable but is not a smoke pass.")
            return
        }
        XCTAssertEqual(snapshot.selection.source, .onDevice)
        XCTAssertTrue((1...2).contains(snapshot.selectedCards.count))
        XCTAssertEqual(snapshot.summary, summary)
        print("LOCAL MODEL SMOKE: actual SystemLanguageModel.default selected valid IDs. " +
              "This does not validate selection quality, battery use or physical-phone performance.")
    }
}
