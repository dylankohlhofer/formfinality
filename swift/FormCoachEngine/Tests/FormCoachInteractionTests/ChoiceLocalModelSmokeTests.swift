import Foundation
import XCTest
import FormCoachInteraction

final class ChoiceLocalModelSmokeTests: XCTestCase {
    /// Explicit, separate opt-in. Deterministic CI skips before any model query.
    /// FORM_COACH_CHOICE_MODEL_SMOKE=1 swift test --filter ChoiceLocalModelSmokeTests
    @MainActor
    func testActualSystemModelWithSharedSyntheticChoiceOptions() async throws {
        try requireOptIn()
        try await runSmoke(ChoiceFixture.request())
    }

    @MainActor
    func testActualSystemModelWithSyntheticPlanOptions() async throws {
        try requireOptIn()
        // Contract-only synthetic presets; no exercise prescription or actual
        // user's plan/measurements enter this opt-in transport smoke.
        let options = try [
            CoachChoiceRequest.Option(id: "preset-a", title: "Preset A", text: "First approved synthetic preset."),
            CoachChoiceRequest.Option(id: "preset-b", title: "Preset B", text: "Second approved synthetic preset.")
        ]
        let request = try CoachChoiceRequest(requestId: "synthetic-plan-smoke", purpose: .plan,
            query: "Choose the second approved preset.", options: options, defaultIds: ["preset-a"], limit: 1)
        try await runSmoke(request)
    }

    private func requireOptIn() throws {
        guard ProcessInfo.processInfo.environment["FORM_COACH_CHOICE_MODEL_SMOKE"] == "1" else {
            throw XCTSkip("Actual choice-model smoke disabled; set FORM_COACH_CHOICE_MODEL_SMOKE=1 explicitly.")
        }
    }

    @MainActor
    private func runSmoke(_ request: CoachChoiceRequest) async throws {
        let coordinator = ChoiceCoordinator()
        coordinator.show(request)
        let id = try XCTUnwrap(coordinator.current?.requestID)
        let started = ContinuousClock.now
        await coordinator.requestOnDeviceSelection(for: id)
        let snapshot = try XCTUnwrap(coordinator.current)
        print("LOCAL CHOICE MODEL SMOKE: purpose=\(request.purpose.rawValue); availability=\(snapshot.modelAvailability?.rawValue ?? "check-did-not-complete"); " +
              "status=\(snapshot.status); source=\(snapshot.selection.source.rawValue); " +
              "reason=\(snapshot.selection.reason.rawValue); choiceIds=\(snapshot.selection.choiceIds); " +
              "elapsed=\(started.duration(to: .now)); synthetic=true; upload=false")
        guard snapshot.status == .selected else {
            XCTAssertEqual(snapshot.selection.source, .template)
            XCTAssertEqual(snapshot.selection.choiceIds, request.defaultIds)
            if case .unavailable(let reason) = snapshot.status {
                throw XCTSkip("COVERAGE GAP: actual choice model unavailable (\(reason.rawValue))")
            }
            XCTFail("Actual local choice smoke failed (\(snapshot.status)); fallback is not a model pass.")
            return
        }
        XCTAssertEqual(snapshot.selection.source, .onDevice)
        XCTAssertTrue((1...request.limit).contains(snapshot.selectedOptions.count))
        XCTAssertEqual(snapshot.request, request)
        print("Local model returned approved IDs. Selection quality, review correctness, battery use, " +
              "and physical-device performance are not established by this smoke.")
    }
}
