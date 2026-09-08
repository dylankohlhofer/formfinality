import XCTest
@testable import FormCoachEngine

extension ConformanceTests {
    func testMovementEvidenceSourceSwitchCannotCompleteRep() {
        let ev = Evaluator(Self.content.movements["push-up"]!, tier: Self.content.tiers["building"]!)
        ev.arm(now: 0)
        var now = 0.0
        @discardableResult func feed(_ f: PoseFrame, _ count: Int) -> FormResult {
            var result = FormResult()
            for _ in 0..<count {
                now += REF_DT
                result = ev.evaluate(f, dt: REF_DT, now: now)
            }
            return result
        }
        let top = frame(pose: "pushTop", over: nil)
        let bottom = frame(pose: "pushBottom", over: nil)
        feed(top, 60); feed(bottom, 60); feed(top, 60)
        XCTAssertEqual(ev.rep?.display(), 1)
        feed(bottom, 60)
        XCTAssertEqual(ev.rep?.state, "up")
        var otherTop = top, otherBottom = bottom
        otherTop.cam = "right"; otherBottom.cam = "right"
        let changed = feed(otherBottom, 1)
        XCTAssertEqual(changed.evidence.movement.source, "right")
        XCTAssertNil(changed.rep)
        feed(otherBottom, 60); feed(otherTop, 60)
        XCTAssertEqual(ev.rep?.display(), 1, "A new side cannot finish the old side's cycle")
        feed(otherBottom, 60); feed(otherTop, 60)
        XCTAssertEqual(ev.rep?.display(), 2, "A fresh observed cycle on the new side counts")

        ev.arm(now: now)
        XCTAssertEqual(ev.rep?.display(), 0)
        XCTAssertNil(ev.avg())
        let fresh = feed(bottom, 1)
        XCTAssertEqual(fresh.evidence.movement.source, "left")
        feed(bottom, 60); feed(top, 60)
        XCTAssertEqual(ev.rep?.display(), 0, "The new set must establish its own resting position")
        feed(bottom, 60); feed(top, 60)
        XCTAssertEqual(ev.rep?.display(), 1, "The new set counts only a fresh complete cycle")
    }

    func testMovementEvidenceAggregateSourcesAndTint() throws {
        let movement = Self.content.movements["leg-raise"]!
        let ev = Evaluator(movement, tier: Self.content.tiers["building"]!)
        ev.arm(now: 0)
        var f = frame(pose: "supine", over: nil)
        f.left["hip"] = Joint(x: 0.54, y: 0.75, c: 0.95)
        f.left["ankle"] = Joint(x: 0.8, y: 0.75, c: 0.95)
        f.left["knee"] = Joint(x: 0.67, y: 0.75, c: 0.95)
        f.right = f.left
        f.right["knee"] = Joint(x: 0.9, y: 0.75, c: 0.95)
        var before = FormResult()
        for i in 0..<60 { before = ev.evaluate(f, dt: REF_DT, now: Double(i + 1) * REF_DT) }
        XCTAssertEqual(try XCTUnwrap(before.readings.first { $0.target.id == "kneesStraight" }).v, 0)
        XCTAssertLessThan(try XCTUnwrap(before.score), 100)
        f.right.removeValue(forKey: "knee")
        let after = ev.evaluate(f, dt: REF_DT, now: 61 * REF_DT)
        XCTAssertEqual(try XCTUnwrap(after.readings.first { $0.target.id == "kneesStraight" }).v, 180,
                       accuracy: 1e-8, "The vanished bad side cannot remain in the smoothed reading")
        XCTAssertEqual(after.score, 100, "The previous side cannot remain in the form score")
        XCTAssertEqual(after.evidence.form.observed.first { $0.target == "kneesStraight" }?.sides, ["left"])

        f.right["knee"] = Joint(x: 0.9, y: 0.75, c: 0.95)
        f.left.removeValue(forKey: "knee")
        let farSide = Evaluator(movement, tier: Self.content.tiers["building"]!)
            .evaluate(f, dt: REF_DT, now: REF_DT)
        XCTAssertEqual(farSide.evidence.form.observed.first { $0.target == "kneesStraight" }?.sides, ["right"])
        XCTAssertEqual(try XCTUnwrap(farSide.readings.first { $0.target.id == "kneesStraight" }).v, 0)
        XCTAssertEqual(farSide.cue, "knees")
        XCTAssertFalse(farSide.tint.segs.contains { $0.a == "knee" || $0.b == "knee" },
                       "A far-side measurement cannot tint the unseen camera-side knee")
    }

    func testMovementEvidenceMissingHoldGateAndRecovery() throws {
        let ev = Evaluator(Self.content.movements["plank"]!, tier: Self.content.tiers["building"]!)
        ev.arm(now: 0)
        let good = frame(pose: "plank", over: nil)
        _ = ev.evaluate(good, dt: 1, now: 1)
        XCTAssertEqual(ev.hold, 1)
        let samples = ev.n
        var lost = good
        lost.left.removeValue(forKey: "ankle"); lost.right.removeValue(forKey: "ankle")
        let missing = ev.evaluate(lost, dt: 1, now: 2)
        XCTAssertTrue(missing.observationPaused)
        XCTAssertFalse(missing.inPose)
        XCTAssertFalse(missing.evidence.movement.eligible)
        XCTAssertEqual(missing.evidence.movement.status, "unavailable")
        XCTAssertTrue(missing.evidence.movement.missing.contains {
            $0.target == "bodyLine" && $0.reason == "tracking"
        })
        XCTAssertTrue(missing.blocking.contains("tracking"))
        XCTAssertNil(missing.score)
        XCTAssertNil(missing.cue)
        XCTAssertFalse(missing.regress)
        XCTAssertTrue(missing.tint.segs.isEmpty)
        XCTAssertEqual(ev.n, samples)
        XCTAssertEqual(ev.hold, 1)
        let recovered = ev.evaluate(good, dt: 1, now: 3)
        XCTAssertTrue(recovered.evidence.movement.eligible)
        XCTAssertEqual(ev.hold, 2, "Recovery adds only newly observed time")

        let encoded = try JSONEncoder().encode(missing.evidence)
        let decoded = try JSONDecoder().decode(MovementEvidence.self, from: encoded)
        XCTAssertEqual(decoded, missing.evidence, "Evidence survives an explicit export")
    }

    func testMovementEvidenceCompleteLossClearsFormHistory() throws {
        let ev = Evaluator(Self.content.movements["plank"]!, tier: Self.content.tiers["building"]!)
        ev.arm(now: 0)
        func neckFrame(forward: Bool) -> PoseFrame {
            var f = frame(pose: "plank", over: nil)
            let shoulder = f.left["shoulder"]!, hip = f.left["hip"]!
            let scale = forward ? 0.25 : -0.25
            f.left["ear"] = Joint(x: shoulder.x + scale * (hip.x - shoulder.x),
                                  y: shoulder.y + scale * (hip.y - shoulder.y), c: 0.95)
            f.right = f.left
            return f
        }
        let bad = neckFrame(forward: true)
        var before = FormResult()
        for i in 0..<60 { before = ev.evaluate(bad, dt: REF_DT, now: Double(i + 1) * REF_DT) }
        XCTAssertLessThan(try XCTUnwrap(before.score), 100)
        let samples = ev.n
        var lost = bad
        lost.left = lost.left.mapValues { Joint(x: $0.x, y: $0.y, c: 0) }
        lost.right = lost.left
        let gap = ev.evaluate(lost, dt: REF_DT, now: 61 * REF_DT)
        XCTAssertNil(gap.score)
        XCTAssertFalse(gap.ok)
        XCTAssertEqual(ev.n, samples)
        let recovered = ev.evaluate(neckFrame(forward: false), dt: REF_DT, now: 62 * REF_DT)
        XCTAssertEqual(try XCTUnwrap(recovered.readings.first { $0.target.id == "neck" }).v, 180, accuracy: 1e-8)
        XCTAssertEqual(recovered.score, 100, "Unobserved history cannot survive in the recovered score pool")
        XCTAssertFalse(recovered.tint.segs.contains { $0.a == "ear" || $0.b == "ear" })
    }

    func testMovementEvidenceRejectsUnreadableSides() throws {
        var f = frame(pose: "plank", over: nil)
        let neck = try XCTUnwrap(Self.content.movements["plank"]!.targets.first { $0.id == "neck" })
        f.left["ear"] = f.left["shoulder"]
        let collapsed = targetObservation(neck, f)
        XCTAssertTrue(collapsed.sides.isEmpty)
        XCTAssertEqual(collapsed.reason, "unreadable")

        let line = try XCTUnwrap(Self.content.movements["plank"]!.targets.first { $0.id == "hipAlign" })
        f.left["ankle"] = f.left["shoulder"]
        XCTAssertEqual(targetObservation(line, f).reason, "unreadable", "A coincident line has no direction")

        let back = try XCTUnwrap(Self.content.movements["wall-sit"]!.targets.first { $0.id == "backFlat" })
        f.left["shoulder"] = f.left["hip"]
        XCTAssertEqual(targetObservation(back, f).reason, "unreadable", "atan2(0, 0) cannot measure posture")

        let arm = try XCTUnwrap(Self.content.movements["bird-dog"]!.targets.first { $0.id == "armLine" })
        let side: SideJoints = ["shoulder": Joint(x: 0.4, y: 0.5, c: 0.95),
                               "hip": Joint(x: 0.6, y: 0.5, c: 0.95),
                               "wrist": Joint(x: 0.2, y: 0.5, c: 0.95)]
        var bilateral = PoseFrame(left: side, right: side, cam: "left", conf: 0.95, aspect: 1)
        bilateral.left["wrist"] = bilateral.left["shoulder"]
        XCTAssertEqual(targetObservation(arm, bilateral).sides, ["right"],
                       "Provenance excludes a visible side with unreadable geometry")
        for aspect in [0.0, -1, Double.nan, Double.infinity] {
            bilateral.aspect = aspect
            XCTAssertEqual(targetObservation(arm, bilateral).reason, "unreadable")
        }
    }

    func testMovementEvidenceFramingUsesWholeBodyDistance() {
        let side: SideJoints = [
            "shoulder": Joint(x: 0.5, y: 0.4, c: 0.95),
            "hip": Joint(x: 0.5, y: 0.5, c: 0.95),
            "ear": Joint(x: 0.5, y: 0.15, c: 0.95),
            "ankle": Joint(x: 0.5, y: 0.85, c: 0.95)
        ]
        var f = PoseFrame(left: side, right: [:], cam: "left", conf: 0.95)
        let full = framing(f, need: ["shoulder", "hip"])
        XCTAssertEqual(full.verdict, "framed", "Two required points suffice when the body has four")
        XCTAssertEqual(full.fill, 0.7, accuracy: 1e-9, "Distance uses the whole visible body")
        f.left["ear"] = Joint(x: .nan, y: .infinity, c: 0.95)
        f.right = side
        let finite = framing(f, need: ["shoulder", "hip"])
        XCTAssertTrue(finite.fill.isFinite, "An invalid unrelated point cannot poison the distance estimate")
        f.left["ear"] = Joint(x: 1.05, y: 0.15, c: 0.95)
        XCTAssertEqual(framing(f, need: ["shoulder", "hip"]).verdict, "framed")
        f.left["shoulder"] = Joint(x: 1.05, y: 0.4, c: 0.95)
        let clipped = framing(f, need: ["shoulder", "hip"])
        XCTAssertFalse(clipped.ok)
        XCTAssertEqual(clipped.verdict, "clipped")
        XCTAssertEqual(clipped.dir, "left")
    }
}
