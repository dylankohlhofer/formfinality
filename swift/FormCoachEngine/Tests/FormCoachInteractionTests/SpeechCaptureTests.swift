import Foundation
import XCTest
@testable import FormCoachInteraction

@MainActor
final class StubSpeechCapture: SpeechCapturing {
    var availability: SpeechAvailability = .available
    var microphone: SpeechPermissionStatus = .granted
    var recognition: SpeechPermissionStatus = .granted
    var permissions: [(SpeechPermission, @MainActor (SpeechPermissionStatus) -> Void)] = []
    var callbacks: [@MainActor (SpeechCaptureEvent) -> Void] = []
    var begins = 0
    var ends = 0
    var active = false
    var beginFailure: SpeechCaptureFailure?
    var endFailure: SpeechCaptureFailure?
    func permission(_ kind: SpeechPermission) -> SpeechPermissionStatus {
        kind == .microphone ? microphone : recognition
    }
    func requestPermission(_ kind: SpeechPermission,
                           completion: @escaping @MainActor (SpeechPermissionStatus) -> Void) {
        permissions.append((kind, completion))
    }
    func begin(maximumTranscriptBytes: Int,
               receive: @escaping @MainActor (SpeechCaptureEvent) -> Void) throws {
        begins += 1
        if let beginFailure { throw beginFailure }
        active = true
        callbacks.append(receive)
    }
    func end() -> SpeechCaptureFailure? {
        ends += 1
        active = false
        return endFailure
    }
    func grant(_ index: Int) {
        let (kind, callback) = permissions[index]
        if kind == .microphone { microphone = .granted } else { recognition = .granted }
        callback(.granted)
    }
}

final class SpeechCaptureTests: XCTestCase {
    @MainActor
    private func make(_ stub: StubSpeechCapture,
                      now: @escaping @MainActor () -> TimeInterval = { 100 }) -> SpeechCaptureCoordinator {
        SpeechCaptureCoordinator(capture: stub, maximumTranscriptBytes: 128,
                                 captureLifetime: 30, echoGrace: 1, now: now)
    }

    @MainActor
    func testConstructionDoesNotPromptOrOpenMicrophone() async {
        let stub = StubSpeechCapture()
        let subject = make(stub)
        XCTAssertEqual(subject.state, .disabled)
        XCTAssertEqual(stub.begins, 0)
        XCTAssertTrue(stub.permissions.isEmpty)
    }

    @MainActor
    func testExplicitStartRequestsBothPermissionsSequentially() async {
        let stub = StubSpeechCapture()
        stub.microphone = .undetermined
        stub.recognition = .undetermined
        let subject = make(stub)
        var states: [SpeechListeningState] = []
        subject.onStateChange = { states.append($0) }
        subject.startFromUserAction()
        XCTAssertEqual(stub.permissions.count, 1)
        XCTAssertEqual(stub.permissions[0].0, .microphone)
        XCTAssertEqual(stub.begins, 0)
        stub.grant(0)
        XCTAssertEqual(stub.permissions.count, 2)
        XCTAssertEqual(stub.permissions[1].0, .recognition)
        stub.grant(1)
        XCTAssertEqual(stub.begins, 1)
        XCTAssertEqual(states, [.requestingPermission, .listening])
        subject.disable()
    }

    @MainActor
    func testPermissionDenialDoesNotRequestNextPermissionOrCapture() async {
        let stub = StubSpeechCapture()
        stub.microphone = .undetermined
        stub.recognition = .undetermined
        let subject = make(stub)
        subject.startFromUserAction()
        stub.permissions[0].1(.denied)
        XCTAssertEqual(subject.state, .failed(.permissionDenied))
        XCTAssertEqual(stub.permissions.count, 1)
        XCTAssertEqual(stub.begins, 0)
    }

    @MainActor
    func testRestrictedAndDeniedKnownPermissionsNeverPrompt() async {
        for kind in [SpeechPermission.microphone, .recognition] {
            for denied in [SpeechPermissionStatus.denied, .restricted] {
                let stub = StubSpeechCapture()
                if kind == .microphone { stub.microphone = denied } else { stub.recognition = denied }
                let subject = make(stub)
                subject.startFromUserAction()
                XCTAssertEqual(subject.state, .failed(.permissionDenied))
                XCTAssertTrue(stub.permissions.isEmpty)
                XCTAssertEqual(stub.begins, 0)
            }
        }
    }

    @MainActor
    func testUnavailableNeverPromptsAndHasNoFallback() async {
        for availability in [SpeechAvailability.frameworkUnavailable, .localeUnsupported,
                             .onDeviceUnavailable, .temporarilyUnavailable] {
            let stub = StubSpeechCapture()
            stub.availability = availability
            stub.microphone = .undetermined
            let subject = make(stub)
            subject.startFromUserAction()
            XCTAssertEqual(subject.state, .unavailable(availability))
            XCTAssertTrue(stub.permissions.isEmpty)
            XCTAssertEqual(stub.begins, 0)
        }
    }

    @MainActor
    func testDisableDuringPermissionIgnoresLateGrant() async {
        let stub = StubSpeechCapture()
        stub.microphone = .undetermined
        stub.recognition = .undetermined
        let subject = make(stub)
        subject.startFromUserAction()
        subject.disable()
        stub.grant(0)
        XCTAssertEqual(subject.state, .disabled)
        XCTAssertEqual(stub.permissions.count, 1)
        XCTAssertEqual(stub.begins, 0)
    }

    @MainActor
    func testBackgroundInvalidatesPermissionAndRequiresExplicitRestart() async {
        let stub = StubSpeechCapture()
        stub.microphone = .undetermined
        let subject = make(stub)
        subject.startFromUserAction()
        subject.setForeground(false)
        stub.grant(0)
        subject.setForeground(true)
        subject.tick()
        XCTAssertEqual(subject.state, .background)
        XCTAssertEqual(stub.begins, 0)
        subject.startFromUserAction()
        XCTAssertEqual(subject.state, .listening)
        subject.disable()
    }

    @MainActor
    func testBackgroundDisableAndResetReleaseAndIgnoreLateResults() async {
        for operation in 0..<3 {
            let stub = StubSpeechCapture()
            let subject = make(stub)
            var received = 0
            subject.onTranscript = { _, _ in received += 1 }
            subject.startFromUserAction()
            switch operation {
            case 0: subject.setForeground(false)
            case 1: subject.disable()
            default: subject.reset()
            }
            stub.callbacks[0](.transcript("pause", isFinal: true))
            stub.callbacks[0](.failure(.recognition))
            XCTAssertFalse(stub.active)
            XCTAssertEqual(received, 0)
            XCTAssertEqual(subject.state, operation == 0 ? .background : .disabled)
        }
    }

    @MainActor
    func testNewStartRejectsOldRecognitionCallbacks() async {
        let stub = StubSpeechCapture()
        let subject = make(stub)
        var received = 0
        subject.onTranscript = { _, _ in received += 1 }
        subject.startFromUserAction()
        subject.startFromUserAction()
        stub.callbacks[0](.transcript("pause", isFinal: true))
        XCTAssertEqual(received, 0)
        XCTAssertEqual(subject.state, .listening)
        stub.callbacks[1](.transcript("pause", isFinal: false))
        XCTAssertEqual(received, 1)
        subject.disable()
    }

    @MainActor
    func testCoachAudioReleasesMicrophoneAndGraceStartsFreshRequest() async {
        let stub = StubSpeechCapture()
        var now = 100.0
        let subject = make(stub, now: { now })
        var received = 0
        subject.onTranscript = { _, _ in received += 1 }
        subject.startFromUserAction()
        subject.setCoachSpeaking(true)
        XCTAssertFalse(stub.active)
        XCTAssertEqual(subject.state, .coachSpeaking)
        stub.callbacks[0](.transcript("pause", isFinal: false))
        subject.setCoachSpeaking(false)
        now = 100.999
        subject.tick()
        XCTAssertEqual(subject.state, .echoGrace)
        XCTAssertEqual(stub.begins, 1)
        now = 101
        subject.tick()
        XCTAssertEqual(subject.state, .listening)
        XCTAssertEqual(stub.begins, 2)
        stub.callbacks[0](.transcript("finish", isFinal: true))
        XCTAssertEqual(received, 0)
        stub.callbacks[1](.transcript("pause", isFinal: false))
        XCTAssertEqual(received, 1)
        subject.disable()
    }

    @MainActor
    func testRepeatedCoachSpeechRestartsGraceAndDisableCannotReopen() async {
        let stub = StubSpeechCapture()
        var now = 100.0
        let subject = make(stub, now: { now })
        subject.startFromUserAction()
        subject.setCoachSpeaking(true)
        subject.setCoachSpeaking(false)
        now = 100.9
        subject.setCoachSpeaking(true)
        subject.setCoachSpeaking(false)
        now = 101
        subject.tick()
        XCTAssertFalse(stub.active)
        subject.disable()
        now = 110
        subject.tick()
        XCTAssertEqual(subject.state, .disabled)
        XCTAssertEqual(stub.begins, 1)
    }

    @MainActor
    func testExpiryChecksCallbackTimeEvenBeforeTimerRuns() async {
        let stub = StubSpeechCapture()
        var now = 100.0
        let subject = make(stub, now: { now })
        var received = 0
        subject.onTranscript = { _, _ in received += 1 }
        subject.startFromUserAction()
        now = 130
        stub.callbacks[0](.transcript("pause", isFinal: true))
        XCTAssertEqual(subject.state, .echoGrace)
        XCTAssertFalse(stub.active)
        XCTAssertEqual(received, 0)
        XCTAssertTrue(subject.isEnabled)
        now = 130.999
        subject.tick()
        XCTAssertEqual(stub.begins, 1)
        now = 131
        subject.tick()
        XCTAssertEqual(stub.begins, 2)
        stub.callbacks[0](.transcript("pause", isFinal: false))
        XCTAssertEqual(received, 0)
        stub.callbacks[1](.transcript("pause", isFinal: false))
        XCTAssertEqual(received, 1)
        subject.disable()
    }

    @MainActor
    func testUTF8BoundRejectsWholeResultWithoutTruncatingIntoCommand() async {
        let stub = StubSpeechCapture()
        let subject = make(stub)
        var received = 0
        subject.onTranscript = { _, _ in received += 1 }
        subject.startFromUserAction()
        stub.callbacks[0](.transcript("pause" + String(repeating: "🟣", count: 32), isFinal: true))
        XCTAssertEqual(received, 0)
        XCTAssertEqual(subject.state, .failed(.transcriptLimit))
        XCTAssertFalse(stub.active)
    }

    @MainActor
    func testFinalResultReleasesBeforeDeliveryAndDoesNotRepeat() async {
        let stub = StubSpeechCapture()
        let subject = make(stub)
        var received = 0
        subject.onTranscript = { _, final in
            XCTAssertTrue(final)
            XCTAssertFalse(stub.active)
            received += 1
        }
        subject.startFromUserAction()
        stub.callbacks[0](.transcript("pause", isFinal: true))
        stub.callbacks[0](.transcript("pause", isFinal: true))
        XCTAssertEqual(received, 1)
        XCTAssertEqual(subject.state, .echoGrace)
        XCTAssertTrue(subject.isEnabled)
        subject.disable()
    }

    @MainActor
    func testCaptureAndReleaseErrorsAreVisibleAndNeverDeliverCommands() async {
        let stub = StubSpeechCapture()
        let subject = make(stub)
        stub.beginFailure = .audioStart
        subject.startFromUserAction()
        XCTAssertEqual(subject.state, .failed(.audioStart))
        XCTAssertFalse(stub.active)
        stub.beginFailure = nil
        subject.startFromUserAction()
        stub.callbacks[0](.failure(.recognition))
        XCTAssertEqual(subject.state, .failed(.recognition))
        subject.startFromUserAction()
        stub.endFailure = .audioRelease
        subject.disable()
        XCTAssertEqual(subject.state, .failed(.audioRelease))
    }

    @MainActor
    func testPermissionDeadlineRejectsLateApprovalWithoutWaitingForTimer() async {
        let stub = StubSpeechCapture()
        stub.microphone = .undetermined
        stub.recognition = .undetermined
        var now = 100.0
        let subject = make(stub, now: { now })
        subject.startFromUserAction()
        now = 110
        stub.grant(0)
        XCTAssertEqual(subject.state, .failed(.permissionTimeout))
        XCTAssertEqual(stub.permissions.count, 1)
        XCTAssertEqual(stub.begins, 0)
    }

    @MainActor
    func testBothPermissionPromptsShareTenSecondDeadline() async {
        let stub = StubSpeechCapture()
        stub.microphone = .undetermined
        stub.recognition = .undetermined
        var now = 100.0
        let subject = make(stub, now: { now })
        subject.startFromUserAction()
        now = 109
        stub.grant(0)
        XCTAssertEqual(stub.permissions.count, 2)
        now = 110
        subject.tick()
        stub.grant(1)
        XCTAssertEqual(subject.state, .failed(.permissionTimeout))
        XCTAssertEqual(stub.begins, 0)
    }

    @MainActor
    func testDuplicatePermissionCallbackCannotRestartCapture() async {
        let stub = StubSpeechCapture()
        stub.microphone = .undetermined
        let subject = make(stub)
        subject.startFromUserAction()
        stub.grant(0)
        stub.grant(0)
        XCTAssertEqual(stub.begins, 1)
        subject.disable()
    }

    @MainActor
    func testFinalsKeepOptInAndRestartAfterQuietWithoutNewPermissionRequest() async {
        let stub = StubSpeechCapture()
        var now = 100.0
        let subject = make(stub, now: { now })
        subject.startFromUserAction()
        let first = subject.requestID
        stub.callbacks[0](.transcript("coach skip", isFinal: true))
        now = 100.999
        subject.tick()
        XCTAssertEqual(stub.begins, 1)
        now = 101
        subject.tick()
        XCTAssertEqual(stub.begins, 2)
        XCTAssertNotEqual(subject.requestID, first)
        XCTAssertTrue(subject.isEnabled)
        XCTAssertTrue(stub.permissions.isEmpty)
        subject.disable()
    }

    @MainActor
    func testStartWhileCoachSpeakingWaitsBeforePermissionPrompt() async {
        let stub = StubSpeechCapture()
        stub.microphone = .undetermined
        var now = 100.0
        let subject = make(stub, now: { now })
        subject.setCoachSpeaking(true)
        subject.startFromUserAction()
        now = 120
        subject.tick()
        XCTAssertEqual(subject.state, .coachSpeaking)
        XCTAssertTrue(stub.permissions.isEmpty)
        subject.setCoachSpeaking(false)
        now = 121
        subject.tick()
        XCTAssertEqual(stub.permissions.count, 1)
        subject.disable()
    }

    @MainActor
    func testReleaseFailureStaysVisibleAndCannotRestartMicrophone() async {
        let stub = StubSpeechCapture()
        let subject = make(stub)
        subject.startFromUserAction()
        stub.endFailure = .audioRelease
        subject.disable()
        stub.endFailure = nil
        subject.reset()
        subject.startFromUserAction()
        XCTAssertEqual(subject.state, .failed(.audioRelease))
        XCTAssertEqual(stub.begins, 1)
    }

    @MainActor
    func testTimedRenewalFailureIsVisibleAndDoesNotRetry() async {
        let stub = StubSpeechCapture()
        var now = 100.0
        let subject = make(stub, now: { now })
        subject.startFromUserAction()
        stub.endFailure = .audioRelease
        now = 130
        subject.tick()
        XCTAssertEqual(subject.state, .failed(.audioRelease))
        XCTAssertFalse(subject.isEnabled)
        now = 140
        subject.tick()
        XCTAssertEqual(stub.begins, 1)
    }
}
