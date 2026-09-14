import Foundation
import XCTest
@testable import FormCoachInteraction

@MainActor
private final class CommandHost: CoachCommandActionHost {
    var commandContext: CoachCommandContext? = .init(token: "workout-1:step-1:active")
    var actions: [CoachCommand] = []
    var pauseOnHelp = true
    func performCommandAction(_ action: CoachCommand) -> Bool {
        actions.append(action)
        if [.explain, .demo, .repeat, .pause].contains(action), pauseOnHelp {
            commandContext = commandContext.map {
                .init(token: "workout-1:step-1:paused", allowed: $0.allowed,
                      otherDialogOpen: $0.otherDialogOpen, calibration: $0.calibration,
                      following: $0.following, coachSpeaking: $0.coachSpeaking)
            }
        }
        return true
    }
}

final class CoachCommandTests: XCTestCase {
    func testAllSharedHTMLCommandVectors() throws {
        var root = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 { root.deleteLastPathComponent() }
        let url = root.appendingPathComponent("testing/coach-command-vectors.json")
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        XCTAssertEqual(object["schema"] as? String, "coach-command-vectors/1")
        let rows = try XCTUnwrap(object["cases"] as? [[String: Any]])
        XCTAssertEqual(rows.count, 39)
        for (index, row) in rows.enumerated() {
            let action = parseCoachCommand(row["input"] as? String,
                                           spoken: row["spoken"] as? Bool ?? false,
                                           final: row["final"] as? Bool ?? true)
            XCTAssertEqual(action?.rawValue, row["expected"] as? String, "Shared JS vector \(index)")
            if let action { XCTAssertTrue(action.bypassLLM) }
        }
    }

    func testUTF16BoundAndExactECMAScriptWhitespace() {
        XCTAssertEqual(parseCoachCommand(String(repeating: " ", count: 115) + "pause"), .pause)
        XCTAssertNil(parseCoachCommand(String(repeating: " ", count: 116) + "pause"))
        XCTAssertEqual(parseCoachCommand("\u{FEFF}coach\u{00A0}pause?!", spoken: true, final: false), .pause)
        XCTAssertNil(parseCoachCommand("coach\u{0085}pause", spoken: true))
        XCTAssertNil(parseCoachCommand("coach, pause", spoken: true))
        XCTAssertNil(parseCoachCommand("coach don't pause", spoken: true, final: false))
    }

    @MainActor
    func testDestructiveRequestsOnlyExecuteAfterMatchingConfirmation() async {
        for (command, confirmation) in [(CoachCommand.skip, CoachCommand.confirmSkip), (.finish, .confirmFinish), (.end, .confirmEnd)] {
            let host = CommandHost()
            host.commandContext?.following = true
            let router = CoachCommandRouter(host: host, now: { 100 })
            XCTAssertEqual(router.route(command), .confirmationRequired)
            XCTAssertEqual(host.actions, [.explain])
            XCTAssertEqual(router.pending?.contextToken, host.commandContext?.token)
            XCTAssertEqual(router.route(confirmation), .performed)
            XCTAssertEqual(host.actions, [.explain, command])
            XCTAssertNil(router.pending)
            XCTAssertEqual(router.route(confirmation), .confirmationMismatch)
            XCTAssertEqual(host.actions.count, 2)
        }
    }

    @MainActor
    func testWrongConfirmationCancelsPendingWithoutAction() async {
        let host = CommandHost()
        let router = CoachCommandRouter(host: host)
        router.route(.skip)
        XCTAssertEqual(router.route(.confirmEnd), .confirmationMismatch)
        XCTAssertNil(router.pending)
        XCTAssertEqual(host.actions, [.explain])
    }

    @MainActor
    func testConfirmationExpiryAndChangedContextCannotExecute() async {
        let host = CommandHost()
        var now = 100.0
        let router = CoachCommandRouter(host: host, now: { now })
        router.route(.skip)
        now = 110.001
        XCTAssertEqual(router.route(.confirmSkip), .confirmationExpired)
        XCTAssertEqual(host.actions, [.explain])
        router.route(.end)
        host.commandContext = .init(token: "new-workout")
        XCTAssertEqual(router.route(.confirmEnd), .confirmationMismatch)
        XCTAssertEqual(host.actions, [.explain, .explain])
    }

    @MainActor
    func testConfirmationTimerBoundaryMatchesHTML() async {
        let host = CommandHost()
        var now = 100.0
        let router = CoachCommandRouter(host: host, now: { now })
        var states: [CoachCommandConfirmation?] = []
        router.onConfirmationChange = { states.append($0) }
        router.route(.skip)
        now = 110
        router.synchronize()
        XCTAssertNil(router.pending)
        XCTAssertEqual(states.count, 2)
        XCTAssertEqual(router.route(.confirmSkip), .confirmationMismatch)
    }

    @MainActor
    func testAssessedFinishRefusedAndCalibrationFinishPermitted() async {
        let host = CommandHost()
        let router = CoachCommandRouter(host: host)
        XCTAssertEqual(router.route(.finish), .finishUnavailable)
        XCTAssertNil(router.pending)
        host.commandContext?.calibration = true
        XCTAssertEqual(router.route(.finish), .confirmationRequired)
        XCTAssertEqual(router.route(.confirmFinish), .performed)
        XCTAssertEqual(host.actions, [.explain, .explain, .finish])
    }

    @MainActor
    func testPauseBypassesOtherDialogButOtherActionsDoNot() async {
        let host = CommandHost()
        host.commandContext?.otherDialogOpen = true
        let router = CoachCommandRouter(host: host)
        XCTAssertEqual(router.route(.skip), .rejected)
        XCTAssertEqual(router.route(.resume), .rejected)
        XCTAssertEqual(router.route(.pause), .performed)
        XCTAssertEqual(host.actions, [.pause])
        host.commandContext?.allowed = false
        XCTAssertEqual(router.route(.pause), .rejected)
    }

    @MainActor
    func testCancelAndPauseClearConfirmation() async {
        let host = CommandHost()
        let router = CoachCommandRouter(host: host)
        router.route(.skip)
        XCTAssertEqual(router.route(.cancel), .cancelled)
        XCTAssertNil(router.pending)
        router.route(.end)
        router.route(.pause)
        XCTAssertNil(router.pending)
        XCTAssertEqual(host.actions, [.explain, .explain, .pause])
    }

    @MainActor
    func testSpokenSkipThenConfirmationUsesContinuousOptInAndOneRouter() async {
        let capture = StubSpeechCapture()
        let host = CommandHost()
        var now = 100.0
        let subject = SpeechCommandCoordinator(capture: capture, host: host, now: { now })
        subject.startFromUserAction()
        capture.callbacks[0](.transcript("coach skip", isFinal: true))
        XCTAssertEqual(host.actions, [.explain])
        XCTAssertNotNil(subject.commands.pending)
        XCTAssertTrue(subject.speech.isEnabled)
        now = 100.749
        subject.speech.tick()
        XCTAssertEqual(capture.begins, 1)
        now = 100.750
        subject.speech.tick()
        XCTAssertEqual(capture.begins, 2)
        capture.callbacks[1](.transcript("coach confirm skip", isFinal: true))
        XCTAssertEqual(host.actions, [.explain, .skip])
        XCTAssertNil(subject.commands.pending)
        XCTAssertTrue(capture.permissions.isEmpty)
        subject.disable()
    }

    @MainActor
    func testPartialPauseIsImmediateAndFinalRevisionCannotExecuteAnotherAction() async {
        let capture = StubSpeechCapture()
        let host = CommandHost()
        host.pauseOnHelp = false // Also prove dedupe when the host is already paused.
        let subject = SpeechCommandCoordinator(capture: capture, host: host)
        subject.startFromUserAction()
        capture.callbacks[0](.transcript("coach pause", isFinal: false))
        XCTAssertEqual(host.actions, [.pause])
        capture.callbacks[0](.transcript("coach pause", isFinal: false))
        capture.callbacks[0](.transcript("coach skip", isFinal: true))
        XCTAssertEqual(host.actions, [.pause])
        XCTAssertNil(subject.commands.pending)
        subject.disable()
    }

    @MainActor
    func testNonPausePartialDoesNothingUntilFinalAndUnknownFinalConsumesRequest() async {
        let capture = StubSpeechCapture()
        let host = CommandHost()
        let subject = SpeechCommandCoordinator(capture: capture, host: host)
        subject.startFromUserAction()
        capture.callbacks[0](.transcript("coach skip", isFinal: false))
        XCTAssertTrue(host.actions.isEmpty)
        capture.callbacks[0](.transcript("coach do not skip", isFinal: true))
        capture.callbacks[0](.transcript("coach skip", isFinal: true))
        XCTAssertTrue(host.actions.isEmpty)
        subject.disable()
    }

    @MainActor
    func testRacingCoachSpeechAndContextChangeRejectEvenUrgentPause() async {
        for speak in [true, false] {
            let capture = StubSpeechCapture()
            let host = CommandHost()
            let subject = SpeechCommandCoordinator(capture: capture, host: host)
            subject.startFromUserAction()
            if speak { host.commandContext?.coachSpeaking = true }
            else { host.commandContext = .init(token: "next-set") }
            capture.callbacks[0](.transcript("coach pause", isFinal: false))
            XCTAssertTrue(host.actions.isEmpty)
            XCTAssertFalse(capture.active)
            subject.disable()
        }
    }

    @MainActor
    func testLifecycleClearsPendingConfirmationAndLateInputCannotAct() async {
        let capture = StubSpeechCapture()
        let host = CommandHost()
        let subject = SpeechCommandCoordinator(capture: capture, host: host)
        subject.startFromUserAction()
        capture.callbacks[0](.transcript("coach end workout", isFinal: true))
        XCTAssertNotNil(subject.commands.pending)
        subject.setForeground(false)
        XCTAssertNil(subject.commands.pending)
        capture.callbacks[0](.transcript("coach confirm end", isFinal: true))
        XCTAssertEqual(host.actions, [.explain])
        subject.setForeground(true)
        XCTAssertFalse(subject.speech.isEnabled)
    }
}
