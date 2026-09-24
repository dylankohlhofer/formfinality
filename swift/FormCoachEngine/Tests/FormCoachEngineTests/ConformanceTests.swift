import XCTest
@testable import FormCoachEngine

/// Replays golden vectors recorded from the RUNNING browser engine. The build they came
/// from is named in `meta.source` of the vectors themselves — not repeated here, because a
/// version number in a comment is exactly what went stale last time.
/// The browser build is the specification; these tests are the port's definition
/// of done. A failure names the scenario, frame and field that diverged.
final class ConformanceTests: XCTestCase {

    // ── vector schema ──
    struct Meta: Codable { let dt: Double; let tolerances: Tol }
    /// Every numeric slack comes from meta.tolerances, which verify.mjs reads too.
    /// Nothing here may hardcode a tolerance: the two harnesses drifted once (score
    /// 1.0 here, 1.5 inline in verify.mjs) and it read as a port divergence for ten
    /// scoreTarget rows that were in fact identical to the browser to the last bit.
    struct Tol: Codable { let value: Double; let score: Double; let hold: Double
        let filter: Double }
    struct ScoreRow: Codable { let movement, target, tier: String; let v: Double
        let score: Double; let cue: String? }
    struct MetricRow: Codable { let movement: String; let frame: Int; let target: String
        let v: Double? }
    struct AspectRow: Codable { let aspect: Double; let hipAngle: Double }
    struct PlanRow: Codable { let plan, tier: String; let steps: [PlanStep] }
    struct ClipVarsRow: Codable { let t: Int?; let p: String?; let x: String? }
    struct ClipRow: Codable { let key: String; let variant: Int; let vars: ClipVarsRow
        let tmpl: String; let manifest: [String]; let expect: [String]? }
    struct SlugRow: Codable { let `in`: String; let out: String }
    /// `kind` and `repsAfter` are what make "acknowledgement precedes accounting"
    /// assertable: an atPeak event carries the rep number the person is working on
    /// while repsAfter still shows the previous total.
    struct RepEventRow: Codable { let i: Int; let kind: String; let n: Int?
        let repsAfter: Int }
    struct DispatchEvent: Codable { let frame: Int; let slot: String; let n: Int?
        let reps: Int }
    struct DispatchRow: Codable { let id, movement, tier: String
        let timeline: [TimelineStep]; let events: [DispatchEvent] }
    struct RepRow: Codable { let name: String; let spec: RepSpec; let seq: [Double]
        let finalReps: Int; let finalState: String; let primed: Bool
        let events: [RepEventRow]; let base: Double? }
    struct Over: Codable { let sideness: Double? }
    /// `over` sets FRAME-level fields; `conf` sets PER-JOINT confidence, which is the
    /// only way to state low visibility as data. Evaluator now checks observations
    /// per target: optional neck loss cannot erase otherwise visible Crunch motion.
    struct TimelineStep: Codable { let pose: String?; let n: Int?; let over: Over?
        let action: String?; let conf: [String: Double]? }
    struct Checkpoint: Codable { let frame: Int; let ok: Bool; let inPosition: Bool
        let inPose: Bool; let blocking: [String]; let viewLimited: Bool
        let viewCue: String?; let score: Int?; let reps: Int; let state: String?
        let cue: String?; let suppressed: [String]; let regress: Bool
        let hold: Double; let guided: Bool }
    struct Scenario: Codable { let id, movement, tier: String
        let timeline: [TimelineStep]; let checkpoints: [Checkpoint] }
    struct FilterRow: Codable { let alpha: Double; let dt: Double; let out: Double }
    struct NeedRow: Codable { let movement: String; let need: [String] }
    struct FramingRow: Codable { let name: String; let box: [Double]
        let ok: Bool; let verdict: String; let dir: String? }
    struct SegPair: Codable { let a: String; let b: String; let sev: Int }
    struct TintDeriv: Codable { let movement: String; let target: String
        let focus: String?; let segs: [[String]] }
    struct TintPhase: Codable { let phase: String; let segs: [SegPair]; let focus: String? }
    struct TintScenario: Codable { let tier: String; let phases: [TintPhase] }
    struct TempoRow: Codable { let movement: String; let tier: String; let cycleSecs: Double
        let minMs: Double; let counted: Int; let rushed: Int }
    struct RateRow: Codable { let fps: Int; let probes: [String: Int]; let trace: Int }
    struct Vectors: Codable {
        let filters: [FilterRow]
        let tempo: [TempoRow]
        let tintDerivation: [TintDeriv]
        let tintScenarios: [TintScenario]
        let framing: [FramingRow]
        let neededJoints: [NeedRow]
        let frameRate: [RateRow]
        let meta: Meta
        let poses: [String: [String: [Double]]]
        let scoreTarget: [ScoreRow]
        let readMetric: [MetricRow]
        let aspect: [AspectRow]
        let planExpansion: [PlanRow]
        let clipResolver: [ClipRow]
        let slug: [SlugRow]
        let repScenarios: [RepRow]
        let repDispatch: [DispatchRow]
        let evaluatorScenarios: [Scenario]
    }

    struct MovementEvidenceSuite: Decodable {
        let schema: String
        let fixtures: [String: MovementEvidenceFixture]
        let cases: [MovementEvidenceCase]
    }
    struct MovementEvidenceFixture: Decodable {
        let rest: String
        let peakPose: String?
        let peak: [String: [Double]]?
    }
    struct MovementEvidenceCase: Decodable {
        let id: String
        let movement: String
        let fps: Int
        let cycle: Bool?
        let loss: MovementEvidenceLoss?
        let reps: Int
        let held: Double
        let eligible: Bool
        let form: String?
        let unscored: Bool?
        let alternatingCam: Bool?
        let scale: Double?
        let mirror: Bool?
        let selected: String?
        let view: MovementEvidenceView?
    }
    struct MovementEvidenceView: Decodable {
        let sideness: Double?
        let unavailable: Bool?
    }
    struct MovementEvidenceLoss: Decodable {
        let all: Bool?
        let joints: [String]?
        let mode: String
        let side: String?
        let after: Double?
    }

    static var vec: Vectors!
    static var content: ContentPack!

    /// THE REPO ROOT — the one canonical home of the vectors and the content.
    ///
    /// These used to be copied into Tests/…/Vectors and shipped as bundle resources.
    /// The copy went stale: root's content-v4.8.json was corrected (side-plank and
    /// crunch demo keyframes, beginner test 01) and the copy was not, so `swift test`
    /// reported 19 readMetric failures describing a divergence that did not exist.
    /// Reading the same files verify.mjs reads makes that class of failure impossible
    /// rather than merely unlikely — there is nothing left to keep in sync.
    static let repoRoot: URL = {
        var u = URL(fileURLWithPath: #filePath)          // …/swift/FormCoachEngine/Tests/FormCoachEngineTests/ConformanceTests.swift
        for _ in 0..<5 { u.deleteLastPathComponent() }   // … up to the repo root
        return u
    }()

    override class func setUp() {
        super.setUp()
        let vURL = repoRoot.appendingPathComponent("conformance-vectors.json")
        let cURL = repoRoot.appendingPathComponent("content-v4.8.json")
        // Fail loudly and by name: a missing fixture must never look like a pass.
        for u in [vURL, cURL] where !FileManager.default.fileExists(atPath: u.path) {
            fatalError("conformance fixture missing: \(u.path) — expected at the repo root")
        }
        vec = try! JSONDecoder().decode(Vectors.self, from: Data(contentsOf: vURL))
        content = try! ContentLoader.load(from: cURL)
    }

    // ── helpers ──
    func frame(pose name: String, over: Over?, conf per: [String: Double]? = nil) -> PoseFrame {
        let src = Self.vec.poses[name]!
        var side: SideJoints = [:]
        for (k, xy) in src { side[k] = Joint(x: xy[0], y: xy[1], c: per?[k] ?? 0.95) }
        return PoseFrame(left: side, right: side, cam: "left", conf: 0.95,
                         aspect: nil, sideness: over?.sideness)
    }
    func refFrame(_ movement: String, _ idx: Int) -> PoseFrame {
        let f = Self.content.ref[movement]!.frames[idx]
        var side: SideJoints = [:]
        for (k, xy) in f where k != "spine" { side[k] = Joint(x: xy[0], y: xy[1], c: 0.95) }
        return PoseFrame(left: side, right: side, cam: "left", conf: 0.95)
    }

    // ── sections ──
    /// Same fixture interpolation, 12-second timeline, losses and independent
    /// expectations as testing/evidence-parity.test.mjs. Never copy the JSON.
    func testMovementEvidence() throws {
        let url = Self.repoRoot.appendingPathComponent("testing/movement-evidence-vectors.json")
        let suite = try JSONDecoder().decode(MovementEvidenceSuite.self, from: Data(contentsOf: url))
        XCTAssertEqual(suite.schema, "movement-evidence-parity/1")
        XCTAssertFalse(suite.cases.isEmpty, "Missing cases cannot count as shared parity")
        for row in suite.cases {
            let fixture = try XCTUnwrap(suite.fixtures[row.movement], row.id)
            let rest = try XCTUnwrap(Self.vec.poses[fixture.rest], row.id)
            let peak: [String: [Double]]
            if let name = fixture.peakPose {
                peak = try XCTUnwrap(Self.vec.poses[name], row.id)
            } else {
                peak = rest.merging(fixture.peak ?? [:]) { _, replacement in replacement }
            }
            let movement = try XCTUnwrap(Self.content.movements[row.movement], row.id)
            let ev = Evaluator(movement, tier: try XCTUnwrap(Self.content.tiers["building"]))
            ev.arm(now: 0)
            guard row.fps > 0 else { XCTFail("\(row.id): FPS must be positive"); return }
            let fps = Double(row.fps)
            var result = FormResult()
            for i in 0..<(12 * row.fps) {
                let phase = (Double(i) / fps).truncatingRemainder(dividingBy: 4)
                let mix = row.cycle != true ? 0 : phase < 1.5 ? phase / 1.5 :
                    phase < 2 ? 1 : phase < 3.5 ? 1 - (phase - 2) / 1.5 : 0
                var side: SideJoints = [:]
                for (name, a) in rest {
                    let b = try XCTUnwrap(peak[name], "\(row.id): peak \(name)")
                    side[name] = Joint(x: a[0] + (b[0] - a[0]) * mix,
                                       y: a[1] + (b[1] - a[1]) * mix, c: 0.95)
                }
                side = side.mapValues { p in
                    Joint(x: 0.5 + (p.x - 0.5) * (row.scale ?? 1) * (row.mirror == true ? -1 : 1),
                          y: 0.5 + (p.y - 0.5) * (row.scale ?? 1), c: p.c)
                }
                let intact = side
                if let loss = row.loss, Double(i) / fps >= (loss.after ?? 0) {
                    let joints = loss.all == true ? Array(side.keys) : try XCTUnwrap(loss.joints, row.id)
                    for name in joints {
                        switch loss.mode {
                        case "missing": side.removeValue(forKey: name)
                        case "outside":
                            let p = try XCTUnwrap(side[name], row.id)
                            side[name] = Joint(x: 1.05, y: p.y, c: p.c)
                        case "low":
                            let p = try XCTUnwrap(side[name], row.id)
                            side[name] = Joint(x: p.x, y: p.y, c: 0.1)
                        default: XCTFail("\(row.id): unknown loss mode \(loss.mode)"); return
                        }
                    }
                }
                let frame = PoseFrame(left: row.loss?.side == "right" ? intact : side,
                                      right: row.loss?.side == "left" ? intact : side,
                                      cam: row.alternatingCam == true && i % 2 == 1 ? "right" : "left", conf: 0.95,
                                      aspect: 1, sideness: row.view?.sideness ?? (row.movement == "side-plank" ? 0 : 90),
                                      viewUnavailable: row.view?.unavailable ?? false)
                result = ev.evaluate(frame, dt: 1 / fps, now: Double(i + 1) / fps)
                XCTAssertEqual(result.evidence.schema, "movement-evidence/1", "\(row.id) frame \(i)")
                if row.unscored == true { XCTAssertNil(result.score, "\(row.id) frame \(i) must remain unscored") }
            }
            XCTAssertEqual(ev.rep?.display() ?? 0, row.reps, row.id)
            if row.unscored == true {
                XCTAssertNil(ev.avg(), row.id); XCTAssertEqual(ev.n, 0, row.id)
                XCTAssertTrue(ev.scoreTrace.isEmpty, row.id)
            }
            XCTAssertLessThan(abs(ev.hold - row.held), 1e-8, "\(row.id): observed hold time")
            XCTAssertEqual(result.evidence.movement.eligible, row.eligible, row.id)
            if let status = row.form { XCTAssertEqual(result.evidence.form.status, status, row.id) }
            if let selected = row.selected { XCTAssertEqual(result.evidence.camera?.selected, selected, row.id) }
        }
    }

    func testActiveRepInterruptionAndRecovery() {
        for loss in ["position", "framing", "view", "confidence", "driver", "missing"] {
            let ev = Evaluator(Self.content.movements["push-up"]!, tier: Self.content.tiers["building"]!)
            ev.arm(now: 0)
            var now = 0.0
            let top = frame(pose: "pushTop", over: nil), bottom = frame(pose: "pushBottom", over: nil)
            func feed(_ f: PoseFrame, _ n: Int) {
                for _ in 0..<n { now += REF_DT; _ = ev.evaluate(f, dt: REF_DT, now: now) }
            }
            feed(top, 60); feed(bottom, 60); feed(top, 60)
            XCTAssertEqual(ev.rep?.display(), 1, "positive control: \(loss)")
            feed(bottom, 60)
            XCTAssertEqual(ev.rep?.state, "up")
            var bad = bottom
            if loss == "position" { bad = frame(pose: "standing", over: nil) }
            if loss == "view" { bad.sideness = 0 }
            for side in ["left", "right"] {
                var points = bad.side(side)
                for (name, p) in points {
                    if loss == "framing" { points[name] = Joint(x: p.x - 2, y: p.y, c: p.c) }
                    if loss == "confidence" || (loss == "driver" && name == "wrist") {
                        points[name] = Joint(x: p.x, y: p.y, c: 0)
                    }
                }
                if side == "left" { bad.left = points } else { bad.right = points }
            }
            if loss == "missing" { ev.interrupt() } else { feed(bad, 1) }
            feed(bottom, 60); feed(top, 60)
            XCTAssertEqual(ev.rep?.display(), 1, "interrupted return: \(loss)")
            feed(bottom, 60); feed(top, 60)
            XCTAssertEqual(ev.rep?.display(), 2, "fresh complete cycle: \(loss)")
        }
    }

    func testBridgeHasNoStaticDriverGrade() {
        let ev = Evaluator(Self.content.movements["glute-bridge"]!, tier: Self.content.tiers["building"]!)
        ev.arm(now: 0)
        var now = 0.0
        for name in ["bridgeDown", "bridgeUp", "bridgeDown"] {
            for _ in 0..<90 {
                now += REF_DT
                let r = ev.evaluate(frame(pose: name, over: nil), dt: REF_DT, now: now)
                XCTAssertNil(r.score); XCTAssertTrue(r.tint.segs.isEmpty)
            }
        }
        XCTAssertEqual(ev.rep?.display(), 1); XCTAssertNil(ev.avg())
    }

    func testGuidedClippingCannotEarnHoldTime() {
        let ev = Evaluator(Self.content.movements["cat-cow"]!, tier: Self.content.tiers["learning"]!)
        var f = frame(pose: "allFours", over: nil)
        f.left = f.left.mapValues { Joint(x: $0.x - 2, y: $0.y, c: $0.c) }; f.right = f.left
        let r = ev.evaluate(f, dt: 1, now: 1)
        // Even wholly unobserved input retains the clipping explanation while
        // refusing to arm, judge form or credit hold time.
        XCTAssertFalse(r.ok)
        XCTAssertFalse(r.inPosition)
        XCTAssertFalse(r.inPose)
        XCTAssertFalse(r.framing.ok)
        XCTAssertEqual(r.framing.verdict, "clipped")
        XCTAssertTrue(r.blocking.contains("framing"))
        XCTAssertEqual(r.evidence.movement.status, "unavailable")
        XCTAssertFalse(r.evidence.movement.eligible)
        XCTAssertEqual(r.evidence.movement.missing,
                       [MissingEvidence(target: "torsoLevel", reason: "clipped")])
        XCTAssertNil(r.score)
        XCTAssertEqual(ev.hold, 0)
    }

    /// The filter conversion itself — identity at 30fps, and no update on a zero dt.
    func testFilterConversion() {
        // meta.tolerances.filter, not exact: the rows store dt rounded to 6dp but
        // were computed at full precision, so emaAlpha lands ~1e-6 away. Asserting
        // 1e-9 here failed all 20 rows against an engine that matches the browser
        // exactly — the vectors' rounding, not the port.
        for r in Self.vec.filters {
            XCTAssertEqual(emaAlpha(r.alpha, r.dt), r.out,
                           accuracy: Self.vec.meta.tolerances.filter,
                           "emaAlpha(alpha: \(r.alpha), dt: \(r.dt))")
        }
    }

    /// The SAME physical movement sampled at 24/30/60/90fps must score the same.
    /// Before dt-normalisation the filters ran ~3.7x faster at 90fps than at 24fps,
    /// so a threshold tuned in the browser would not survive a phone's frame rate.
    func testFrameRateIndependence() {
        let plank = Self.vec.poses["plank"]!
        var sagJ = plank
        sagJ["hip"] = [plank["hip"]![0], plank["hip"]![1] + 0.075]
        sagJ["knee"] = [plank["knee"]![0], plank["knee"]![1] + 0.03]

        func lerp(_ a: [String: [Double]], _ b: [String: [Double]], _ f: Double) -> [String: [Double]] {
            var o: [String: [Double]] = [:]
            for (k, v) in a { o[k] = [v[0] + (b[k]![0] - v[0]) * f, v[1] + (b[k]![1] - v[1]) * f] }
            return o
        }
        func poseAt(_ t: Double) -> [String: [Double]] {
            if t < 3 { return plank }
            if t < 4 { return lerp(plank, sagJ, t - 3) }
            if t < 7 { return sagJ }
            if t < 8 { return lerp(sagJ, plank, t - 7) }
            return plank
        }
        func frameOf(_ j: [String: [Double]]) -> PoseFrame {
            var side: SideJoints = [:]
            for (k, xy) in j { side[k] = Joint(x: xy[0], y: xy[1], c: 0.95) }
            return PoseFrame(left: side, right: side, cam: "left", conf: 0.95)
        }

        for row in Self.vec.frameRate {
            let dt = 1.0 / Double(row.fps)
            let ev = Evaluator(Self.content.movements["plank"]!,
                               tier: Self.content.tiers["building"]!)
            ev.arm(now: 0)
            var now = 0.0
            var r = FormResult()
            let wants = row.probes.keys.compactMap(Double.init).sorted()
            var wi = 0
            var got: [Double: Int] = [:]
            while now < 12 {
                now += dt
                r = ev.evaluate(frameOf(poseAt(now)), dt: dt, now: now)
                while wi < wants.count && now >= wants[wi] {
                    got[wants[wi]] = r.score ?? -999
                    wi += 1
                }
            }
            for (k, want) in row.probes {
                let t = Double(k)!
                XCTAssertEqual(Double(got[t] ?? -999), Double(want), accuracy: 2,
                               "\(row.fps)fps @t=\(k)s")
            }
            XCTAssertEqual(ev.scoreTrace.count, row.trace, "\(row.fps)fps trace density")
        }
    }

    /// minMs: a rep too fast to be controlled is rejected AND reported, and the
    /// floor scales by tier (Strong 0.6x). Declared in content since v4, enforced
    /// since v4.8 — the Swift port must not inherit the old silence.
    func testTempoFloor() {
        let dt = Self.vec.meta.dt
        for row in Self.vec.tempo {
            let spec = Self.content.movements[row.movement]!.reps!
            let scale = Self.content.tiers[row.tier]!.repMin ?? 1
            let rc = RepCounter(spec)
            let lo = (spec.rising == true) ? (spec.downBelow! - 8) : (spec.downAbove! + 8)
            let hi = (spec.rising == true) ? (spec.upAbove! + 8) : (spec.upBelow! - 8)
            let n = Int((row.cycleSecs / dt).rounded())
            var now = 0.0
            for _ in 0..<4 {
                for i in 0..<n {
                    now += dt
                    let f = Double(i) / Double(n)
                    let v = f < 0.5 ? lo + (hi - lo) * (f * 2) : hi + (lo - hi) * ((f - 0.5) * 2)
                    _ = rc.update(v, now: now, dt: dt, minScale: scale)
                }
            }
            XCTAssertEqual(rc.reps, row.counted,
                           "\(row.movement)@\(row.tier) \(row.cycleSecs)s counted")
            XCTAssertEqual(rc.rushed, row.rushed,
                           "\(row.movement)@\(row.tier) \(row.cycleSecs)s rushed")
        }
    }

    /// The tint is DERIVED from each metric spec, so no tint content is authored.
    /// All 68 targets must resolve identically in Swift.
    /// Framing verdicts — the bounding-box check must match the browser exactly,
    /// including which edge maps to which nudge.
    /// Framing only insists on the joints a movement actually measures — a crunch
    /// doesn't grade your feet, so feet out of frame must not block reps.
    func testNeededJoints() {
        for row in Self.vec.neededJoints {
            let mv = Self.content.movements[row.movement]!
            XCTAssertEqual(neededJoints(mv).sorted(), row.need, row.movement)
        }
    }

    func testFraming() {
        for row in Self.vec.framing {
            let (x0,y0,x1,y1) = (row.box[0], row.box[1], row.box[2], row.box[3])
            func at(_ fx: Double, _ fy: Double) -> Joint {
                Joint(x: x0+(x1-x0)*fx, y: y0+(y1-y0)*fy, c: 0.95)
            }
            let side: SideJoints = ["ear": at(0,0), "shoulder": at(0.5,0.1),
                "elbow": at(0.3,0.35), "wrist": at(0,0.5), "hip": at(0.5,0.5),
                "knee": at(0.7,0.75), "ankle": at(1,1), "heel": at(0.9,0.9), "toe": at(1,0.85)]
            let f = framing(PoseFrame(left: side, right: side, cam: "left", conf: 0.95))
            XCTAssertEqual(f.ok, row.ok, "\(row.name) ok")
            XCTAssertEqual(f.verdict, row.verdict, "\(row.name) verdict")
            XCTAssertEqual(f.dir, row.dir, "\(row.name) dir")
        }
    }

    func testTintDerivation() {
        for row in Self.vec.tintDerivation {
            let t = Self.content.movements[row.movement]!.targets.first { $0.id == row.target }!
            let got = tintSegs(t.m)
            XCTAssertEqual(got.focus, row.focus, "\(row.movement).\(row.target) focus")
            XCTAssertEqual(got.segs.count, row.segs.count, "\(row.movement).\(row.target) seg count")
            for (i, pair) in row.segs.enumerated() {
                XCTAssertEqual(got.segs[i].0, pair[0], "\(row.movement).\(row.target) seg \(i).a")
                XCTAssertEqual(got.segs[i].1, pair[1], "\(row.movement).\(row.target) seg \(i).b")
            }
        }
    }

    /// Severity through a scripted sag, per tier — including the hysteresis latch and
    /// the Learning rule (one part, amber only, never red).
    func testTintScenarios() {
        let dt = Self.vec.meta.dt
        let plank = Self.vec.poses["plank"]!
        var mild = plank, bad = plank
        mild["hip"] = [plank["hip"]![0], plank["hip"]![1] + 0.045]
        mild["knee"] = [plank["knee"]![0], plank["knee"]![1] + 0.02]
        bad["hip"] = [plank["hip"]![0], plank["hip"]![1] + 0.10]
        bad["knee"] = [plank["knee"]![0], plank["knee"]![1] + 0.05]
        func frameOf(_ j: [String: [Double]]) -> PoseFrame {
            var side: SideJoints = [:]
            for (k, xy) in j { side[k] = Joint(x: xy[0], y: xy[1], c: 0.95) }
            return PoseFrame(left: side, right: side, cam: "left", conf: 0.95)
        }
        for sc in Self.vec.tintScenarios {
            let ev = Evaluator(Self.content.movements["plank"]!,
                               tier: Self.content.tiers[sc.tier]!)
            ev.arm(now: 0)
            var now = 0.0
            var r = FormResult()
            let steps: [(String, [String: [Double]], Int)] =
                [("clean", plank, 40), ("mild", mild, 60), ("bad", bad, 60), ("clean", plank, 90)]
            for (i, step) in steps.enumerated() {
                for _ in 0..<step.2 { now += dt; r = ev.evaluate(frameOf(step.1), dt: dt, now: now) }
                let want = sc.phases[i]
                let got = r.tint.segs
                    .map { SegPair(a: $0.a, b: $0.b, sev: $0.sev) }
                    .sorted { ($0.a + $0.b) < ($1.a + $1.b) }
                XCTAssertEqual(got.count, want.segs.count, "\(sc.tier)/\(want.phase) seg count")
                for (n, w) in want.segs.enumerated() where n < got.count {
                    XCTAssertEqual(got[n].a, w.a, "\(sc.tier)/\(want.phase) seg \(n).a")
                    XCTAssertEqual(got[n].b, w.b, "\(sc.tier)/\(want.phase) seg \(n).b")
                    XCTAssertEqual(got[n].sev, w.sev, "\(sc.tier)/\(want.phase) seg \(n).sev")
                }
                XCTAssertEqual(r.tint.focus, want.focus, "\(sc.tier)/\(want.phase) focus")
            }
        }
    }

    func testScoreAndCues() {
        for r in Self.vec.scoreTarget {
            let mv = Self.content.movements[r.movement]!
            let t = mv.targets.first { $0.id == r.target }!
            let tt = Self.content.tiers[r.tier]!.tol
            XCTAssertEqual(scoreTarget(t, r.v, tierTol: tt), r.score,
                           accuracy: Self.vec.meta.tolerances.score,
                           "\(r.movement).\(r.target)@\(r.tier) v=\(r.v)")
            XCTAssertEqual(cueFor(t, r.v, tierTol: tt), r.cue,
                           "cue \(r.movement).\(r.target)@\(r.tier) v=\(r.v)")
        }
    }

    func testReadMetricOverRefFrames() {
        for r in Self.vec.readMetric {
            let mv = Self.content.movements[r.movement]!
            let t = mv.targets.first { $0.id == r.target }!
            let got = readMetric(t.m, refFrame(r.movement, r.frame), "left")
            if let want = r.v {
                XCTAssertNotNil(got, "\(r.movement)[\(r.frame)].\(r.target)")
                XCTAssertEqual(got!, want, accuracy: Self.vec.meta.tolerances.value,
                               "\(r.movement)[\(r.frame)].\(r.target)")
            } else { XCTAssertNil(got) }
        }
    }

    func testAspectEquivalence() {
        let mv = Self.content.movements["downward-dog"]!
        let spec = mv.targets.first { $0.id == "hipAngle" }!.m
        let phys = Self.content.ref["downward-dog"]!.frames[1]
        for row in Self.vec.aspect {
            var side: SideJoints = [:]
            for (k, xy) in phys where k != "spine" {
                side[k] = Joint(x: xy[0] / row.aspect, y: xy[1], c: 0.95)
            }
            let fr = PoseFrame(left: side, right: side, cam: "left", conf: 0.95, aspect: row.aspect)
            XCTAssertEqual(readMetric(spec, fr, "left")!, row.hipAngle,
                           accuracy: Self.vec.meta.tolerances.value, "aspect \(row.aspect)")
        }
    }

    func testPlanExpansion() {
        for r in Self.vec.planExpansion {
            let plan = Self.content.plans.first { $0.id == r.plan }!
            let got = expandPlanSteps(plan.steps, tier: Self.content.tiers[r.tier]!)
            XCTAssertEqual(got, r.steps, "\(r.plan)@\(r.tier)")
        }
    }

    func testReviewedClipCompleteness() throws {
        struct Suite: Decodable { let schema: String; let cases: [ClipRow] }
        let url = Self.repoRoot.appendingPathComponent("testing/clip-resolution-vectors.json")
        let suite = try JSONDecoder().decode(Suite.self, from: Data(contentsOf: url))
        XCTAssertEqual(suite.schema, "clip-resolution/1")
        XCTAssertEqual(suite.cases.count, 25)
        for r in suite.cases {
            let man = Set(r.manifest)
            XCTAssertEqual(clipPlanFor(personaId: "warm", tierId: "building", key: r.key,
                variant: r.variant, vars: ClipVars(t: r.vars.t, p: r.vars.p, x: r.vars.x),
                tmpl: r.tmpl, has: { man.contains($0) }), r.expect,
                "\(r.key): \(r.tmpl), manifest \(r.manifest)")
        }
    }

    func testClipResolverAndSlug() {
        for r in Self.vec.slug { XCTAssertEqual(slugTok(r.in), r.out) }
        for r in Self.vec.clipResolver {
            let man = Set(r.manifest)
            let got = clipPlanFor(personaId: "warm", tierId: "building", key: r.key,
                                  variant: r.variant,
                                  vars: ClipVars(t: r.vars.t, p: r.vars.p, x: r.vars.x),
                                  tmpl: r.tmpl, has: { man.contains($0) })
            XCTAssertEqual(got, r.expect, "clip \(r.key) \(r.tmpl)")
        }
    }

    /// How the harness reads an event's kind. Deliberately the same precedence the
    /// engine dispatches by — atPeak first, because it is the only event that says
    /// nothing about whether the cycle completed.
    func kind(_ e: RepEvent) -> String {
        e.atPeak ? "atPeak" : e.rejected ? "rejected" : e.short ? "short" : "rep"
    }

    func testRepScenarios() {
        let dt = Self.vec.meta.dt
        for r in Self.vec.repScenarios {
            let rc = RepCounter(r.spec)
            var now = 0.0
            var events: [(i: Int, kind: String, n: Int, repsAfter: Int)] = []
            for (i, v) in r.seq.enumerated() {
                now += dt
                if let ev = rc.update(v, now: now) {
                    events.append((i, kind(ev), ev.n, rc.reps))
                }
            }
            XCTAssertEqual(rc.reps, r.finalReps, "\(r.name) reps")
            XCTAssertEqual(rc.state, r.finalState, "\(r.name) state")
            XCTAssertEqual(rc.primed, r.primed, "\(r.name) primed")
            XCTAssertEqual(events.map { $0.i }, r.events.map { $0.i }, "\(r.name) event frames")
            XCTAssertEqual(events.map { $0.kind }, r.events.map { $0.kind }, "\(r.name) event kinds")
            XCTAssertEqual(events.map { $0.repsAfter }, r.events.map { $0.repsAfter },
                           "\(r.name) reps after each event")
            for (got, want) in zip(events, r.events) {
                guard let wn = want.n else { continue }   // short/rejected carry no rep number
                XCTAssertEqual(got.n, wn, "\(r.name) event n @frame \(want.i)")
            }
            // The property itself, stated once rather than inferred from the lists:
            // every counted rep is preceded by an atPeak carrying the SAME number,
            // at an EARLIER frame, while the count still reads one less.
            for (idx, want) in r.events.enumerated() where want.kind == "rep" {
                let peak = r.events[..<idx].last { $0.kind == "atPeak" }
                XCTAssertNotNil(peak, "\(r.name) rep \(want.n ?? -1) has no preceding atPeak")
                if let p = peak {
                    XCTAssertEqual(p.n, want.n, "\(r.name) atPeak/rep number agree")
                    XCTAssertEqual(p.repsAfter, want.repsAfter - 1,
                                   "\(r.name) atPeak must not move the count")
                    XCTAssertEqual(p.i < want.i, true, "\(r.name) atPeak precedes the count")
                }
            }
            if let b = r.base { XCTAssertEqual(rc.base ?? .nan, b, accuracy: 0.1, "\(r.name) base") }
        }
    }

    /// THE DOUBLE-COUNT TRAP, as a vector rather than as an inspection.
    ///
    /// atPeak reaches the shell through the same dispatch as rep/short/tooFast, and
    /// needs a branch of its own ahead of the final `else`. Without one the
    /// up-crossing is routed to `rep` and the shell hears "rep completed" twice per
    /// rep — at the top and again at the bottom — while the counter itself never
    /// moves, which is what makes it invisible to a count-only assertion. These rows
    /// record the SLOT each event landed in, frame by frame, so the fall-through
    /// fails by name. Verified by mutation: deleting the branch fails four rows here
    /// and nothing else in the suite.
    func testRepDispatch() {
        let dt = Self.vec.meta.dt
        for row in Self.vec.repDispatch {
            let ev = Evaluator(Self.content.movements[row.movement]!,
                               tier: Self.content.tiers[row.tier]!)
            var now = 0.0
            var frameIdx = 0
            var got: [(frame: Int, slot: String, n: Int?, reps: Int)] = []
            for step in row.timeline {
                if step.action == "arm" { ev.arm(now: now); continue }
                guard let pose = step.pose, let n = step.n else { continue }
                for _ in 0..<n {
                    now += dt
                    let r = ev.evaluate(frame(pose: pose, over: step.over, conf: step.conf), dt: dt, now: now)
                    let slot: String? = r.atPeak != nil ? "atPeak"
                                      : r.tooFast != nil ? "tooFast"
                                      : r.short != nil ? "short"
                                      : r.rep != nil ? "rep" : nil
                    if let s = slot {
                        got.append((frameIdx, s, (r.atPeak ?? r.rep)?.n, r.reps))
                    }
                    frameIdx += 1
                }
            }
            XCTAssertEqual(got.count, row.events.count, "\(row.id) event count")
            for (g, w) in zip(got, row.events) {
                XCTAssertEqual(g.frame, w.frame, "\(row.id) event frame")
                XCTAssertEqual(g.slot, w.slot, "\(row.id) f\(w.frame) slot")
                XCTAssertEqual(g.n, w.n, "\(row.id) f\(w.frame) n")
                XCTAssertEqual(g.reps, w.reps, "\(row.id) f\(w.frame) reps")
            }
        }
    }

    func testEvaluatorScenarios() {
        let dt = Self.vec.meta.dt
        let tol = Self.vec.meta.tolerances
        for sc in Self.vec.evaluatorScenarios {
            let ev = Evaluator(Self.content.movements[sc.movement]!,
                               tier: Self.content.tiers[sc.tier]!)
            var now = 0.0
            var r = FormResult()
            var frameIdx = 0
            var cpIdx = 0
            for step in sc.timeline {
                if step.action == "arm" { ev.arm(now: now); continue }
                if step.action == "check" {
                    let want = sc.checkpoints[cpIdx]; cpIdx += 1
                    let tag = "\(sc.id)@frame\(frameIdx - 1)"
                    XCTAssertEqual(r.ok, want.ok, "\(tag).ok")
                    XCTAssertEqual(r.inPosition, want.inPosition, "\(tag).inPosition")
                    XCTAssertEqual(r.inPose, want.inPose, "\(tag).inPose")
                    XCTAssertEqual(r.blocking, want.blocking, "\(tag).blocking")
                    XCTAssertEqual(r.viewLimited, want.viewLimited, "\(tag).viewLimited")
                    XCTAssertEqual(r.viewCue, want.viewCue, "\(tag).viewCue")
                    XCTAssertEqual(r.reps, want.reps, "\(tag).reps")
                    XCTAssertEqual(r.state, want.state, "\(tag).state")
                    XCTAssertEqual(r.cue, want.cue, "\(tag).cue")
                    XCTAssertEqual(r.suppressed, want.suppressed, "\(tag).suppressed")
                    XCTAssertEqual(r.regress, want.regress, "\(tag).regress")
                    XCTAssertEqual(r.guided, want.guided, "\(tag).guided")
                    XCTAssertEqual(ev.hold, want.hold, accuracy: tol.hold, "\(tag).hold")
                    if let ws = want.score {
                        XCTAssertEqual(Double(r.score ?? -999), Double(ws),
                                       accuracy: tol.score, "\(tag).score")
                    } else { XCTAssertNil(r.score, "\(tag).score-nil") }
                    continue
                }
                guard let pose = step.pose, let n = step.n else { continue }
                for _ in 0..<n {
                    now += dt
                    r = ev.evaluate(frame(pose: pose, over: step.over, conf: step.conf), dt: dt, now: now)
                    frameIdx += 1
                }
            }
            XCTAssertEqual(cpIdx, sc.checkpoints.count, "\(sc.id): all checkpoints consumed")
        }
    }
}
